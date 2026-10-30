"use client";

import {
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { CustomApiModal } from "@/components/CustomApiModal";
import { ApiKeyNotice } from "@/components/workshop/ApiKeyNotice";
import { ErrorCard } from "@/components/workshop/ErrorCard";
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
import { HistorySection } from "@/components/workshop/HistorySection";
import { KeepHistorySwitch } from "@/components/workshop/KeepHistorySwitch";
import { PageHeader } from "@/components/workshop/PageHeader";
import { PromptInput } from "@/components/workshop/PromptInput";
import { ReferenceImagesInput } from "@/components/workshop/ReferenceImagesInput";
import {
  ResultSection,
  toRenderedItems,
} from "@/components/workshop/ResultSection";
import { SubmitBar } from "@/components/workshop/SubmitBar";
import { TimingPanel } from "@/components/workshop/TimingPanel";
import { UpdateNotice } from "@/components/workshop/UpdateNotice";
import { useReferenceImages } from "@/components/workshop/use-reference-images";
import { DEFAULT_IMAGE_MODEL } from "@/lib/models";
import { useCustomApi } from "@/lib/use-custom-api";
import {
  type HistoryEntry,
  useGenerationHistory,
} from "@/lib/use-generation-history";
import { useTimings } from "@/lib/use-timings";
import {
  type GenerateApiResult,
  type ImagesGenerationsResponse,
  isGenerateError,
  readApiJson,
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
  // 进行中的「优化提示词」请求；切换 tab 时中止，晚到的结果直接丢弃
  const optimizeAbortRef = useRef<AbortController | null>(null);
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
  // detail 是上游原始报错，在红色卡片里完整展示
  const [error, setErrorState] = useState<{
    message: string;
    detail?: string;
  } | null>(null);
  const setError = useCallback(
    (message: string | null, detail?: string) =>
      setErrorState(message === null ? null : { message, detail }),
    [],
  );
  const {
    uploadedImages,
    uploadFileList,
    setUploadFileList,
    uploading,
    clearUploadedImages,
    uploadReferenceImage,
    addReferenceUrl,
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
  const {
    entries: historyEntries,
    add: addHistory,
    remove: removeHistory,
    clearAll: clearHistory,
    enabled: historyEnabled,
    setEnabled: setHistoryEnabled,
    deletedKeys: deletedHistoryKeys,
  } = useGenerationHistory();
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

  /**
   * 存进图床的结果记到「最近生成」（本站临时图 30 分钟就没了，不记）。
   * 用户关了「在本地保留」开关就不记。
   */
  function recordHistory(
    data: ImagesGenerationsResponse["data"],
    meta: Pick<HistoryEntry, "prompt" | "model" | "size" | "mode">,
  ) {
    if (!historyEnabled) return;
    const createdAt = Date.now();
    addHistory(
      data.flatMap((item): HistoryEntry[] =>
        item.url && item.storeKey && item.deleteToken
          ? [
              {
                id: item.storeKey,
                url: item.url,
                storeKey: item.storeKey,
                deleteToken: item.deleteToken,
                bytes: item.bytes,
                createdAt,
                ...meta,
              },
            ]
          : [],
      ),
    );
  }

  /** 「最近生成」里点编辑：同「编辑该图片」，直接用图床 URL 当参考图。 */
  function handleEditHistory(entry: HistoryEntry) {
    const ext = entry.url.split(".").pop()?.toLowerCase() ?? "png";
    void handleEditResult({ src: entry.url, ext }, 0);
  }

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

      const json = await readApiJson<GenerateApiResult>(res);

      if (!res.ok || isGenerateError(json)) {
        if (isGenerateError(json)) setError(json.error, json.detail);
        else setError(`请求失败 (${res.status})`);
        return;
      }

      if (!json.data || json.data.length === 0) {
        setError("接口未返回图片");
        return;
      }

      setResult(json);
      recordHistory(json.data, {
        prompt,
        model,
        size: usedSize,
        mode: "generate",
      });
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
    const controller = new AbortController();
    optimizeAbortRef.current = controller;
    setOptimizing(true);
    setError(null);
    try {
      const res = await fetch("/api/optimize-prompt", {
        method: "POST",
        signal: controller.signal,
        headers: buildHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          prompt,
          model: settings.optimizeModel,
          mode,
        }),
      });
      const json = await readApiJson<{ prompt?: string }>(res);
      if (controller.signal.aborted) return;
      if (isGenerateError(json)) {
        setError(json.error, json.detail);
        return;
      }
      if (!res.ok || !json.prompt) {
        setError(`优化失败 (${res.status})`);
        return;
      }
      if (json.prompt !== prompt) {
        setOptimizeUndo({ before: prompt, after: json.prompt, undone: false });
      }
      setPrompt(json.prompt);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      // 被中止的请求由 cancelOptimize 收尾，这里只处理自己仍是当前请求的情况
      if (optimizeAbortRef.current === controller) {
        optimizeAbortRef.current = null;
        setOptimizing(false);
      }
    }
  }

  /** 中止进行中的「优化提示词」，结果不再回填。 */
  function cancelOptimize() {
    optimizeAbortRef.current?.abort();
    optimizeAbortRef.current = null;
    setOptimizing(false);
  }

  function handleToggleOptimize() {
    if (!optimizeUndo || !canToggleOptimize) return;
    const undone = !optimizeUndo.undone;
    setOptimizeUndo({ ...optimizeUndo, undone });
    setPrompt(undone ? optimizeUndo.before : optimizeUndo.after);
  }

  const parsedExternalUrls = parseExternalUrls(externalUrl);

  /** 「编辑该图片」：把生成结果加为参考图（有公网 URL 就直接用，否则先上传），生成模式下顺带切到编辑模式。 */
  async function handleEditResult(item: RenderedItem, index: number) {
    if (loading || uploading) return;
    if (mode === Mode.Edit && uploadFileList.length >= MAX_UPLOAD_COUNT) {
      setError(`最多只能上传 ${MAX_UPLOAD_COUNT} 张参考图片`);
      return;
    }

    // 已经是公网 URL（图床或本站临时图）：直接当参考图，不再下载再上传一遍
    if (/^https?:\/\//i.test(item.src)) {
      if (mode !== Mode.Edit) handleSwitchMode(Mode.Edit);
      setImageSource(ImageSource.Upload);
      const name =
        decodeURIComponent(item.src.split("/").pop() ?? "") ||
        `result-${index + 1}.${item.ext}`;
      addReferenceUrl(item.src, name);
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    // 回落成 base64 的结果没有公网地址，只能先上传到本站临时目录
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
      const json = await readApiJson<GenerateApiResult>(res);
      if (!res.ok || isGenerateError(json)) {
        if (isGenerateError(json)) setError(json.error, json.detail);
        else setError(`请求失败 (${res.status})`);
        return;
      }
      if (!json.data || json.data.length === 0) {
        setError("接口未返回图片");
        return;
      }
      setResult(json);
      recordHistory(json.data, {
        prompt,
        model,
        size: usedSize,
        mode: "edit",
      });
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
    // 优化是按当前模式的提示词发的，切走后结果不该回填到新模式
    cancelOptimize();
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
      <UpdateNotice />
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

          <KeepHistorySwitch
            enabled={historyEnabled}
            onToggle={setHistoryEnabled}
            entryCount={historyEntries.length}
            onClearAll={clearHistory}
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

        {error && <ErrorCard message={error.message} detail={error.detail} />}

        {result && renderedItems.length > 0 && (
          <ResultSection
            result={result}
            renderedItems={renderedItems}
            lastDurationMs={lastDurationMs}
            onEditResult={(item, idx) => void handleEditResult(item, idx)}
            historyEnabled={historyEnabled}
            deletedKeys={deletedHistoryKeys}
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

        {/* 历史记录读 localStorage，服务端渲染时没有，等客户端再显示 */}
        {isClient && historyEntries.length > 0 && (
          <HistorySection
            entries={historyEntries}
            onRemove={removeHistory}
            onClearAll={clearHistory}
            onEdit={handleEditHistory}
            editDisabled={loading || uploading}
          />
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
