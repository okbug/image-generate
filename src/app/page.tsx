"use client";

import { use, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { CustomApiModal } from "@/components/CustomApiModal";
import { ApiKeyNotice } from "@/components/workshop/ApiKeyNotice";
import {
  EDIT_DEFAULT_PROMPT,
  ImageSource,
  MAX_UPLOAD_COUNT,
  Mode,
  PROMPT_PRESETS,
  QUALITY_OPTIONS,
  type RenderedItem,
  SIZE_OPTIONS,
  clampSide,
  parseExternalUrls,
  validateExternalUrls,
} from "@/components/workshop/constants";
import { GenerationOptions } from "@/components/workshop/GenerationOptions";
import { PageHeader } from "@/components/workshop/PageHeader";
import { PromptInput } from "@/components/workshop/PromptInput";
import { ReferenceImagesInput } from "@/components/workshop/ReferenceImagesInput";
import {
  ResultSection,
  toRenderedItems,
} from "@/components/workshop/ResultSection";
import { SubmitBar } from "@/components/workshop/SubmitBar";
import { TimingPanel } from "@/components/workshop/TimingPanel";
import { useReferenceImages } from "@/components/workshop/use-reference-images";
import { DEFAULT_IMAGE_MODEL } from "@/lib/models";
import { useCustomApi } from "@/lib/use-custom-api";
import { useTimings } from "@/lib/use-timings";
import {
  type GenerateApiResult,
  type ImagesGenerationsResponse,
  isGenerateError,
} from "@/types/images";

function noopSubscribe() {
  return () => {};
}

/** 编辑模式在 URL 上记 mode=edit，生成模式去掉该参数；用 replaceState 不产生历史记录。 */
function syncModeToUrl(mode: Mode) {
  const url = new URL(window.location.href);
  if (mode === Mode.Edit) url.searchParams.set("mode", Mode.Edit);
  else url.searchParams.delete("mode");
  window.history.replaceState(window.history.state, "", url);
}

export default function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // URL 带 ?mode=edit 时直接进入编辑模式（刷新后保持在编辑 tab）
  const initialMode =
    use(searchParams).mode === Mode.Edit ? Mode.Edit : Mode.Generate;
  const [mode, setMode] = useState<Mode>(initialMode);
  const [imageSource, setImageSource] = useState<ImageSource>(
    ImageSource.Upload,
  );
  const [externalUrl, setExternalUrl] = useState("");
  const [prompt, setPrompt] = useState(
    initialMode === Mode.Edit ? EDIT_DEFAULT_PROMPT : PROMPT_PRESETS[0],
  );
  const [model, setModel] = useState(DEFAULT_IMAGE_MODEL);
  const [size, setSize] = useState(SIZE_OPTIONS[0].value);
  const [quality, setQuality] = useState(QUALITY_OPTIONS[0].value);
  const [customWidth, setCustomWidth] = useState(1024);
  const [customHeight, setCustomHeight] = useState(1024);
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  // 最近一次优化前后的两版文本，用来在「撤销优化 / 恢复优化」之间切换
  const [optimizeUndo, setOptimizeUndo] = useState<{
    before: string;
    after: string;
    undone: boolean;
  } | null>(null);
  // 输入框内容不再是记录里的那一版（手动编辑、点示例、切模式回填）时，按钮自动隐藏
  const canToggleOptimize =
    optimizeUndo !== null &&
    prompt === (optimizeUndo.undone ? optimizeUndo.before : optimizeUndo.after);
  const [error, setError] = useState<string | null>(null);
  const {
    uploadedImages,
    uploadFileList,
    setUploadFileList,
    uploading,
    clearUploadedImages,
    uploadReferenceImage,
    removeUploadedImage,
    uploadProps,
  } = useReferenceImages({ loading, setError });
  const [result, setResult] = useState<ImagesGenerationsResponse | null>(null);
  // 耗时：startedAt 非空表示正在计时，elapsedMs 每 100ms 刷新一次
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [lastDurationMs, setLastDurationMs] = useState<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const {
    settings,
    save: saveCustomApi,
    buildHeaders,
    active: customApiActive,
  } = useCustomApi();
  const {
    entries: timingEntries,
    add: addTiming,
    clear: clearTimings,
    averages: timingAverages,
  } = useTimings();
  const [apiModalOpen, setApiModalOpen] = useState(false);
  // 凭证存在 localStorage，服务端渲染时读不到；等到客户端再判断，避免已填用户每次刷新都闪一下提示条
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const needCustomApi = isClient && !customApiActive;

  // 进入页面时尝试清理服务端遗留的过期临时图片
  useEffect(() => {
    fetch("/api/cleanup", { method: "POST" }).catch(() => {});
  }, []);

  // 出图期间每 100ms 更新一次已用时长（起始值由发起请求处置为 0）
  useEffect(() => {
    if (startedAt === null) return;
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 100);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  function resolveSize(): string {
    if (size !== "custom") return size;
    return `${clampSide(customWidth)}x${clampSide(customHeight)}`;
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const usedSize = resolveSize();
    const begunAt = Date.now();
    setStartedAt(begunAt);
    setElapsedMs(0);
    let ok = false;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: buildHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          prompt,
          model,
          size: usedSize,
          quality,
        }),
      });

      const json = (await res.json()) as GenerateApiResult;

      if (!res.ok || isGenerateError(json)) {
        const message = isGenerateError(json)
          ? json.error
          : `请求失败 (${res.status})`;
        setError(message);
        return;
      }

      if (!json.data || json.data.length === 0) {
        setError("接口未返回图片");
        return;
      }

      setResult(json);
      ok = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      const ms = Date.now() - begunAt;
      setStartedAt(null);
      setElapsedMs(ms);
      setLastDurationMs(ms);
      addTiming({ mode: "generate", model, size: usedSize, ms, ok });
      setLoading(false);
    }
  }

  async function handleOptimize() {
    if (!customApiActive) {
      setApiModalOpen(true);
      return;
    }
    if (!prompt.trim() || optimizing || loading) return;
    setOptimizing(true);
    setError(null);
    try {
      const res = await fetch("/api/optimize-prompt", {
        method: "POST",
        headers: buildHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          prompt,
          model: settings.optimizeModel,
          mode,
        }),
      });
      const json = (await res.json()) as { prompt?: string; error?: string };
      if (!res.ok || !json.prompt) {
        setError(json.error ?? `优化失败 (${res.status})`);
        return;
      }
      if (json.prompt !== prompt) {
        setOptimizeUndo({ before: prompt, after: json.prompt, undone: false });
      }
      setPrompt(json.prompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setOptimizing(false);
    }
  }

  function handleToggleOptimize() {
    if (!optimizeUndo || !canToggleOptimize) return;
    const undone = !optimizeUndo.undone;
    setOptimizeUndo({ ...optimizeUndo, undone });
    setPrompt(undone ? optimizeUndo.before : optimizeUndo.after);
  }

  const parsedExternalUrls = parseExternalUrls(externalUrl);

  /** 「编辑该图片」：把生成结果当参考图上传到本站，生成模式下顺带切到编辑模式。 */
  async function handleEditResult(item: RenderedItem, index: number) {
    if (loading || uploading) return;
    if (mode === Mode.Edit && uploadFileList.length >= MAX_UPLOAD_COUNT) {
      setError(`最多只能上传 ${MAX_UPLOAD_COUNT} 张参考图片`);
      return;
    }

    const id = crypto.randomUUID();
    let file: File;
    try {
      const res = await fetch(item.src);
      if (!res.ok) throw new Error(`读取图片失败 (${res.status})`);
      const blob = await res.blob();
      file = new File(
        [blob],
        `result-${index + 1}-${id.slice(0, 8)}.${item.ext}`,
        {
          type: blob.type || `image/${item.ext === "jpg" ? "jpeg" : item.ext}`,
        },
      );
    } catch (err) {
      setError(
        err instanceof Error ? `读取图片失败：${err.message}` : "读取图片失败",
      );
      return;
    }

    if (mode !== Mode.Edit) handleSwitchMode(Mode.Edit);
    setImageSource(ImageSource.Upload);

    const uid = `result-${id}`;
    setUploadFileList((current) => [
      ...current,
      { uid, name: file.name, status: "uploading", percent: 0 },
    ]);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    await uploadReferenceImage(file, uid);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    let imageUrls: string[];
    if (imageSource === ImageSource.Url) {
      const validationError = validateExternalUrls(parsedExternalUrls);
      if (validationError) {
        setError(validationError);
        return;
      }
      imageUrls = parsedExternalUrls;
    } else {
      if (uploadedImages.length === 0) {
        setError("请先上传参考图片");
        return;
      }
      if (uploading) {
        setError("图片仍在上传，请稍后再编辑");
        return;
      }
      imageUrls = uploadedImages.map((image) => image.url);
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const usedSize = resolveSize();
    const begunAt = Date.now();
    setStartedAt(begunAt);
    setElapsedMs(0);
    let ok = false;

    try {
      const res = await fetch("/api/edit", {
        method: "POST",
        headers: buildHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          prompt,
          imageUrls,
          model,
          size: usedSize,
          quality,
        }),
      });
      const json = (await res.json()) as GenerateApiResult;
      if (!res.ok || isGenerateError(json)) {
        setError(
          isGenerateError(json) ? json.error : `请求失败 (${res.status})`,
        );
        return;
      }
      if (!json.data || json.data.length === 0) {
        setError("接口未返回图片");
        return;
      }
      setResult(json);
      ok = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      const ms = Date.now() - begunAt;
      setStartedAt(null);
      setElapsedMs(ms);
      setLastDurationMs(ms);
      addTiming({ mode: "edit", model, size: usedSize, ms, ok });
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    if (!customApiActive) {
      e.preventDefault();
      setApiModalOpen(true);
      return;
    }
    if (mode === Mode.Edit) return handleEdit(e);
    return handleGenerate(e);
  }

  function handleSwitchMode(next: Mode) {
    if (next === mode || loading || uploading) return;
    setMode(next);
    syncModeToUrl(next);
    setError(null);
    // 切换模式时清理已上传图（避免遗留）
    if (uploadedImages.length > 0) clearUploadedImages();
    // 模式切换时按上下文回填默认 prompt（用户已改过则保留）
    if (next === Mode.Edit && PROMPT_PRESETS.includes(prompt)) {
      setPrompt(EDIT_DEFAULT_PROMPT);
    } else if (
      next === Mode.Generate &&
      (!prompt.trim() || prompt === EDIT_DEFAULT_PROMPT)
    ) {
      setPrompt(PROMPT_PRESETS[0]);
    }
  }

  function handleSwitchImageSource(next: ImageSource) {
    if (loading || uploading || imageSource === next) return;
    setImageSource(next);
    setError(null);
    // 切到 URL 模式时清掉已上传的临时图
    if (next === ImageSource.Url && uploadedImages.length > 0) {
      clearUploadedImages();
    }
  }

  const renderedItems = toRenderedItems(result);

  const submitDisabled =
    !customApiActive ||
    loading ||
    uploading ||
    !prompt.trim() ||
    (mode === Mode.Edit &&
      imageSource === ImageSource.Upload &&
      uploadedImages.length === 0) ||
    (mode === Mode.Edit &&
      imageSource === ImageSource.Url &&
      parsedExternalUrls.length === 0);

  return (
    <div className="app-aurora min-h-screen px-4 py-6 md:px-8 md:py-14">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 md:gap-10">
        <PageHeader
          mode={mode}
          model={model}
          loading={loading}
          uploading={uploading}
          customApiActive={customApiActive}
          needCustomApi={needCustomApi}
          handleSwitchMode={handleSwitchMode}
          onOpenSettings={() => setApiModalOpen(true)}
        />

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="glass flex flex-col gap-4 rounded-2xl p-4 sm:gap-5 sm:rounded-3xl sm:p-6 md:p-8"
        >
          {needCustomApi && (
            <ApiKeyNotice onOpenSettings={() => setApiModalOpen(true)} />
          )}
          {mode === Mode.Edit && (
            <ReferenceImagesInput
              imageSource={imageSource}
              onSwitchSource={handleSwitchImageSource}
              loading={loading}
              uploading={uploading}
              uploadProps={uploadProps}
              uploadedImages={uploadedImages}
              uploadFileList={uploadFileList}
              onRemoveImage={removeUploadedImage}
              externalUrl={externalUrl}
              setExternalUrl={setExternalUrl}
              parsedExternalUrls={parsedExternalUrls}
            />
          )}

          <PromptInput
            prompt={prompt}
            setPrompt={setPrompt}
            mode={mode}
            optimizing={optimizing}
            loading={loading}
            customApiActive={customApiActive}
            canToggleOptimize={canToggleOptimize}
            optimizeUndone={optimizeUndo?.undone ?? false}
            handleOptimize={handleOptimize}
            handleToggleOptimize={handleToggleOptimize}
          />

          <GenerationOptions
            model={model}
            setModel={setModel}
            size={size}
            setSize={setSize}
            quality={quality}
            setQuality={setQuality}
            customWidth={customWidth}
            setCustomWidth={setCustomWidth}
            customHeight={customHeight}
            setCustomHeight={setCustomHeight}
            loading={loading}
          />

          <SubmitBar
            mode={mode}
            loading={loading}
            elapsedMs={elapsedMs}
            lastDurationMs={lastDurationMs}
            needCustomApi={needCustomApi}
            disabled={submitDisabled}
          />
        </form>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50/80 px-5 py-4 text-sm text-red-700 backdrop-blur dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            <strong className="font-semibold">出错了：</strong> {error}
          </div>
        )}

        {result && renderedItems.length > 0 && (
          <ResultSection
            result={result}
            renderedItems={renderedItems}
            lastDurationMs={lastDurationMs}
            onEditResult={(item, idx) => void handleEditResult(item, idx)}
            editDisabled={loading || uploading}
          />
        )}

        {timingEntries.length > 0 && (
          <TimingPanel
            entries={timingEntries}
            averages={timingAverages}
            onClear={clearTimings}
          />
        )}

        {!result && !error && !loading && (
          <div className="glass flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-2xl px-5 py-8 text-center text-sm text-sand-500 dark:text-sand-400 sm:min-h-[180px] sm:rounded-3xl sm:px-6 sm:py-10">
            <span className="text-3xl">🎨</span>
            <p className="px-2">
              还没有作品。先写一段 prompt，点击「生成图片」开始吧。
            </p>
          </div>
        )}
      </div>

      <CustomApiModal
        open={apiModalOpen}
        initial={settings}
        onClose={() => setApiModalOpen(false)}
        onSave={saveCustomApi}
      />
    </div>
  );
}
