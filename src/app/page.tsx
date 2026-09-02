"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Image, Select, Upload, type UploadFile, type UploadProps } from "antd";
import { ClipboardPaste, ImagePlus, UploadCloud, X } from "lucide-react";

import { CustomApiModal } from "@/components/CustomApiModal";
import { useCustomApi } from "@/lib/use-custom-api";
import {
  type GenerateApiResult,
  type ImageItem,
  type ImageUsage,
  type ImagesGenerationsResponse,
  extFromFormat,
  isGenerateError,
  mimeFromFormat,
} from "@/types/images";

const SIZE_OPTIONS = [
  { label: "3840×2160 · 4K横向", value: "3840x2160" },
  { label: "2160×3840 · 4K纵向", value: "2160x3840" },
  { label: "1792×1024 · 横向", value: "1792x1024" },
  { label: "1024×1792 · 纵向", value: "1024x1792" },
  { label: "1024×1024 · 方形", value: "1024x1024" },
  { label: "自定义", value: "custom" },
];

const CUSTOM_SIZE_MIN = 256;
const CUSTOM_SIZE_MAX = 4096;

const QUALITY_OPTIONS = [
  { label: "标准", value: "standard" },
  { label: "高清", value: "hd" },
];

const PROMPT_PRESETS = [
  "黄昏海边的玻璃小屋，落地窗映着粉橙色晚霞，宫崎骏风格水彩",
  "一只在月球上喝咖啡的柴犬，复古胶片质感",
  "巨大鲸鱼在云海中游弋，吉卜力梦幻场景，柔光",
  "京都樱花小巷，黄昏阳光斜照，浮世绘水彩",
];

const EDIT_DEFAULT_PROMPT = "提升画面清晰度与细节，让色彩更鲜明、画面更锐利";
const MAX_UPLOAD_COUNT = 10;
const UPLOAD_ACCEPT = "image/png,image/jpeg,image/webp";
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

type RenderedItem = {
  src: string;
  revisedPrompt?: string;
  ext: string;
};

enum Mode {
  Generate = "generate",
  Edit = "edit",
}

enum ImageSource {
  Upload = "upload",
  Url = "url",
}

const MODE_OPTIONS: Array<{ value: Mode; label: string }> = [
  { value: Mode.Generate, label: "生成" },
  { value: Mode.Edit, label: "编辑" },
];

const IMAGE_SOURCE_OPTIONS: Array<{ value: ImageSource; label: string }> = [
  { value: ImageSource.Upload, label: "上传图片" },
  { value: ImageSource.Url, label: "图片 URL" },
];

type UploadedImage = {
  uid: string;
  url: string;
  fileName: string;
  previewSrc: string;
  name: string;
};

export default function Home() {
  const [mode, setMode] = useState<Mode>(Mode.Generate);
  const [imageSource, setImageSource] = useState<ImageSource>(ImageSource.Upload);
  const [externalUrl, setExternalUrl] = useState("");
  const [prompt, setPrompt] = useState(PROMPT_PRESETS[0]);
  const [size, setSize] = useState(SIZE_OPTIONS[0].value);
  const [quality, setQuality] = useState(QUALITY_OPTIONS[0].value);
  const [customWidth, setCustomWidth] = useState(1024);
  const [customHeight, setCustomHeight] = useState(1024);
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [uploadFileList, setUploadFileList] = useState<UploadFile[]>([]);
  const uploading = uploadFileList.some((file) => file.status === "uploading");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImagesGenerationsResponse | null>(null);
  const uploadedImagesRef = useRef<UploadedImage[]>([]);

  const { settings, save: saveCustomApi, buildHeaders, active: customApiActive } =
    useCustomApi();
  const [apiModalOpen, setApiModalOpen] = useState(false);

  // 进入页面时尝试清理服务端遗留的过期临时图片
  useEffect(() => {
    fetch("/api/cleanup", { method: "POST" }).catch(() => {});
  }, []);

  function clampSide(n: number): number {
    if (!Number.isFinite(n)) return CUSTOM_SIZE_MIN;
    return Math.min(Math.max(Math.round(n), CUSTOM_SIZE_MIN), CUSTOM_SIZE_MAX);
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

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: buildHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ prompt, size: resolveSize(), quality }),
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }

  async function handleOptimize() {
    if (!prompt.trim() || optimizing || loading) return;
    setOptimizing(true);
    setError(null);
    try {
      const res = await fetch("/api/optimize-prompt", {
        method: "POST",
        headers: buildHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ prompt }),
      });
      const json = (await res.json()) as { prompt?: string; error?: string };
      if (!res.ok || !json.prompt) {
        setError(json.error ?? `优化失败 (${res.status})`);
        return;
      }
      setPrompt(json.prompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setOptimizing(false);
    }
  }

  const deleteRemoteFile = useCallback(async (fileName: string) => {
    try {
      await fetch(`/api/upload?name=${encodeURIComponent(fileName)}`, {
        method: "DELETE",
      });
    } catch {
      // 删除失败不阻塞主流程
    }
  }, []);

  function releaseUploadedImage(image: UploadedImage) {
    URL.revokeObjectURL(image.previewSrc);
    void deleteRemoteFile(image.fileName);
  }

  const clearUploadedImages = useCallback(() => {
    setUploadedImages((current) => {
      current.forEach((image) => {
        URL.revokeObjectURL(image.previewSrc);
        void deleteRemoteFile(image.fileName);
      });
      return [];
    });
    setUploadFileList([]);
  }, [deleteRemoteFile]);

  useEffect(() => {
    uploadedImagesRef.current = uploadedImages;
  }, [uploadedImages]);

  useEffect(
    () => () => {
      uploadedImagesRef.current.forEach((image) => {
        URL.revokeObjectURL(image.previewSrc);
        void deleteRemoteFile(image.fileName);
      });
    },
    [deleteRemoteFile],
  );

  function validateUploadFile(file: File): string | null {
    if (!UPLOAD_ACCEPT.split(",").includes(file.type)) {
      return "仅支持 PNG / JPG / WebP";
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      return "图片不能超过 10MB";
    }
    return null;
  }

  function parseExternalUrls(value: string): string[] {
    return Array.from(
      new Set(
        value
          .split(/[\n,，]+/)
          .map((url) => url.trim())
          .filter(Boolean),
      ),
    );
  }

  const parsedExternalUrls = parseExternalUrls(externalUrl);

  function validateExternalUrls(urls: string[]): string | null {
    if (urls.length === 0) return "请填写图片 URL";
    if (urls.length > MAX_UPLOAD_COUNT) {
      return `最多只能填写 ${MAX_UPLOAD_COUNT} 个图片 URL`;
    }
    if (urls.some((url) => !/^https?:\/\//i.test(url))) {
      return "每个 URL 都需以 http(s):// 开头";
    }
    return null;
  }

  async function uploadReferenceImage(file: File, uid: string): Promise<boolean> {
    if (loading) return false;
    const validationError = validateUploadFile(file);
    if (validationError) {
      setError(validationError);
      setUploadFileList((current) =>
        current.filter((item) => item.uid !== uid),
      );
      return false;
    }
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = (await res.json()) as {
        url?: string;
        fileName?: string;
        error?: string;
      };
      if (!res.ok || !json.url || !json.fileName) {
        setError(json.error ?? `上传失败 (${res.status})`);
        setUploadFileList((current) =>
          current.filter((item) => item.uid !== uid),
        );
        return false;
      }
      const uploadedImage: UploadedImage = {
        uid,
        url: json.url,
        fileName: json.fileName,
        previewSrc: URL.createObjectURL(file),
        name: file.name,
      };
      setUploadedImages((current) => [...current, uploadedImage]);
      setUploadFileList((current) =>
        current.map((item) =>
          item.uid === uid
            ? {
                ...item,
                status: "done",
                percent: 100,
                url: json.url,
                thumbUrl: uploadedImage.previewSrc,
                response: json,
              }
            : item,
        ),
      );
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
      setUploadFileList((current) =>
        current.filter((item) => item.uid !== uid),
      );
      return false;
    }
  }

  function handleUploadChange(nextFileList: UploadFile[]) {
    setUploadFileList(nextFileList.slice(0, MAX_UPLOAD_COUNT));
  }

  async function handleUploadRemove(file: UploadFile) {
    setUploadedImages((current) => {
      const removed = current.find((image) => image.uid === file.uid);
      if (removed) releaseUploadedImage(removed);
      return current.filter((image) => image.uid !== file.uid);
    });
    return true;
  }

  const uploadProps: UploadProps = {
    accept: UPLOAD_ACCEPT,
    multiple: true,
    maxCount: MAX_UPLOAD_COUNT,
    fileList: uploadFileList,
    showUploadList: false,
    disabled: loading || uploadedImages.length >= MAX_UPLOAD_COUNT,
    pastable: true,
    beforeUpload: (file, fileList) => {
      const availableSlots = MAX_UPLOAD_COUNT - uploadFileList.length;
      const nextIndex = fileList.findIndex((item) => item.uid === file.uid);
      if (availableSlots <= 0 || nextIndex >= availableSlots) {
        setError(`最多只能上传 ${MAX_UPLOAD_COUNT} 张参考图片`);
        return Upload.LIST_IGNORE;
      }
      const validationError = validateUploadFile(file);
      if (validationError) {
        setError(validationError);
        return Upload.LIST_IGNORE;
      }
      return true;
    },
    onChange: ({ fileList }) => handleUploadChange(fileList),
    onRemove: handleUploadRemove,
    customRequest: ({ file, onSuccess }) => {
      const imageFile = file as File & { uid?: string };
      const uid = imageFile.uid ?? `${Date.now()}-${imageFile.name}`;
      void uploadReferenceImage(imageFile, uid).then((ok) => {
        if (ok) onSuccess?.({ ok: true }, imageFile);
      });
    },
  };

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

    try {
      const res = await fetch("/api/edit", {
        method: "POST",
        headers: buildHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          prompt,
          imageUrls,
          size: resolveSize(),
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    if (mode === Mode.Edit) return handleEdit(e);
    return handleGenerate(e);
  }

  function handleSwitchMode(next: Mode) {
    if (next === mode || loading || uploading) return;
    setMode(next);
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

  const renderedItems: RenderedItem[] = (result?.data ?? []).flatMap(
    (item: ImageItem): RenderedItem[] => {
      const ext = extFromFormat(result?.output_format);
      if (item.b64_json) {
        const mime = mimeFromFormat(result?.output_format);
        return [
          {
            src: `data:${mime};base64,${item.b64_json}`,
            revisedPrompt: item.revised_prompt,
            ext,
          },
        ];
      }
      if (item.url) {
        return [{ src: item.url, revisedPrompt: item.revised_prompt, ext }];
      }
      return [];
    },
  );

  return (
    <div className="app-aurora min-h-screen px-4 py-6 md:px-8 md:py-14">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 md:gap-10">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col items-start gap-2.5 md:gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200/70 bg-white/60 px-3 py-1 text-[11px] font-medium text-zinc-700 backdrop-blur dark:border-zinc-700/60 dark:bg-zinc-900/50 dark:text-zinc-300 md:text-xs">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              模型 gpt-image-2 · {mode === Mode.Edit ? "图像编辑" : "实时生成"}
            </span>
            <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
              <span className="gradient-text">AI 图片工坊</span>
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 md:text-base">
              {mode === Mode.Edit
                ? "上传最多三张参考图，描述想要的修改，由模型重绘。"
                : "把你脑中的画面写下来，几秒后就能拿到一张高清成片。"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-start">
            <div className="flex h-10 items-center gap-1 rounded-full border border-zinc-200/80 bg-white/70 p-1 backdrop-blur dark:border-zinc-700/70 dark:bg-zinc-900/60">
              {MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSwitchMode(opt.value)}
                  disabled={loading || uploading}
                  className={`inline-flex h-full items-center justify-center rounded-full px-4 text-xs font-medium transition active:scale-95 disabled:cursor-not-allowed ${
                    mode === opt.value
                      ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-sm"
                      : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setApiModalOpen(true)}
              title="自定义 API 凭证"
              className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full border bg-white/70 text-base backdrop-blur transition active:scale-95 hover:border-indigo-300 dark:bg-zinc-900/60 ${
                customApiActive
                  ? "border-indigo-300 text-indigo-600 dark:border-indigo-500/60 dark:text-indigo-300"
                  : "border-zinc-200/80 text-zinc-600 dark:border-zinc-700/70 dark:text-zinc-300"
              }`}
            >
              ⚙️
              {customApiActive && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-900" />
              )}
            </button>
          </div>
        </header>

        <form
          onSubmit={handleSubmit}
          className="glass flex flex-col gap-4 rounded-2xl p-4 sm:gap-5 sm:rounded-3xl sm:p-6 md:p-8"
        >
          {mode === Mode.Edit && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  参考图片
                </span>
                <div className="flex h-8 shrink-0 items-center gap-1 rounded-full border border-zinc-200/80 bg-white/70 p-0.5 backdrop-blur dark:border-zinc-700/70 dark:bg-zinc-900/60">
                  {IMAGE_SOURCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        if (loading || uploading || imageSource === opt.value)
                          return;
                        setImageSource(opt.value);
                        setError(null);
                        // 切到 URL 模式时清掉已上传的临时图
                        if (
                          opt.value === ImageSource.Url &&
                          uploadedImages.length > 0
                        ) {
                          clearUploadedImages();
                        }
                      }}
                      disabled={loading || uploading}
                      className={`inline-flex h-full items-center justify-center rounded-full px-3 text-xs font-medium transition active:scale-95 disabled:cursor-not-allowed ${
                        imageSource === opt.value
                          ? "bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-900"
                          : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-xs leading-relaxed text-amber-800 backdrop-blur dark:border-amber-700/40 dark:bg-amber-500/10 dark:text-amber-200">
                <span className="font-semibold">⚠️ 隐私提示：</span>
                请勿上传涉及隐私、身份信息或敏感内容的图片。你上传的图片会临时保存在本网站约 30 分钟，
                用于发起编辑请求；网站设有定时清理机制，过期文件会被自动删除，请放心使用。
              </div>

              {imageSource === ImageSource.Upload ? (
                <div className="flex flex-col gap-3">
                  <Upload.Dragger {...uploadProps} className="reference-upload">
                    <div className="flex flex-col items-center gap-2 px-4 py-3 text-center">
                      {uploading ? (
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                      ) : (
                        <UploadCloud className="h-7 w-7 text-indigo-500" />
                      )}
                      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                        点击、拖拽或粘贴参考图片
                      </span>
                      <span className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                        支持 PNG / JPG / WebP，单张最大 10MB，最多 {MAX_UPLOAD_COUNT} 张
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-500">
                        <ClipboardPaste className="h-3.5 w-3.5" />
                        复制图片后在此区域按 Ctrl / Cmd + V
                      </span>
                    </div>
                  </Upload.Dragger>

                  {uploadedImages.length > 0 && (
                    <Image.PreviewGroup>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {uploadedImages.map((image, idx) => (
                          <div
                            key={image.uid}
                            className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white/70 dark:border-zinc-700 dark:bg-zinc-900/50"
                          >
                            <Image
                              src={image.previewSrc}
                              alt={`已上传参考图 ${idx + 1}`}
                              className="!h-36 !w-full object-cover"
                              preview={{ mask: "预览" }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setUploadFileList((current) =>
                                  current.filter(
                                    (file) => file.uid !== image.uid,
                                  ),
                                );
                                setUploadedImages((current) => {
                                  const removed = current.find(
                                    (item) => item.uid === image.uid,
                                  );
                                  if (removed) releaseUploadedImage(removed);
                                  return current.filter(
                                    (item) => item.uid !== image.uid,
                                  );
                                });
                              }}
                              disabled={loading}
                              title="移除图片"
                              className="absolute top-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-zinc-950/70 text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <X className="h-4 w-4" />
                            </button>
                            <div className="flex flex-col gap-1 px-3 py-2 text-xs">
                              <span className="flex items-center gap-1.5 font-medium text-zinc-800 dark:text-zinc-200">
                                <ImagePlus className="h-3.5 w-3.5" />
                                参考图 {idx + 1}
                              </span>
                              <span className="truncate text-zinc-500 dark:text-zinc-500">
                                {image.name || image.fileName}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Image.PreviewGroup>
                  )}

                  <p className="text-[11px] text-zinc-500 dark:text-zinc-500">
                    已上传 {uploadedImages.length}/{MAX_UPLOAD_COUNT}
                    {uploading ? "，仍有图片上传中" : ""}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    rows={3}
                    placeholder="https://example.com/a.png, https://example.com/b.webp"
                    className="w-full resize-y rounded-xl border border-zinc-200 bg-white/80 px-3.5 py-3 text-sm leading-relaxed text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/10 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                  />
                  <div className="flex flex-col gap-1 text-[11px] text-zinc-500 dark:text-zinc-500">
                    <p>
                      可一次填写最多 {MAX_UPLOAD_COUNT} 个图片 URL，用英文逗号、中文逗号或换行分隔。
                    </p>
                    <p>
                      URL 必须公网可达，模型服务端将通过地址拉取图片，本网站不会暂存它。
                    </p>
                  </div>
                  {parsedExternalUrls.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-500">
                        <span>
                          已识别 {parsedExternalUrls.length}/{MAX_UPLOAD_COUNT} 个 URL
                        </span>
                        {parsedExternalUrls.length > MAX_UPLOAD_COUNT && (
                          <span className="font-medium text-red-600 dark:text-red-300">
                            超出上限，请删除多余 URL
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {parsedExternalUrls.slice(0, MAX_UPLOAD_COUNT).map((url, idx) => (
                          <div
                            key={url}
                            className="overflow-hidden rounded-xl border border-zinc-200 bg-white/70 dark:border-zinc-700 dark:bg-zinc-900/50"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={`URL 参考图 ${idx + 1}`}
                              className="h-36 w-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                            <div className="flex flex-col gap-1 px-3 py-2 text-xs">
                              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                                URL 参考图 {idx + 1}
                              </span>
                              <span className="truncate text-zinc-500 dark:text-zinc-500">
                                {url}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Prompt
            </span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              placeholder={
                mode === Mode.Edit
                  ? "描述你想对参考图做的修改，越具体越好…"
                  : "描述你想要的画面，越具体越好…"
              }
              disabled={optimizing}
              className="w-full resize-y rounded-xl border border-zinc-200 bg-white/80 px-3.5 py-3 text-base leading-relaxed text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-400/10 disabled:opacity-60 sm:text-sm dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400 dark:focus:bg-zinc-900"
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {mode === Mode.Generate ? (
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pt-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
                  {PROMPT_PRESETS.map((p) => (
                    <button
                      type="button"
                      key={p}
                      onClick={() => setPrompt(p)}
                      className="shrink-0 whitespace-nowrap rounded-full border border-zinc-200 bg-white/70 px-3 py-1.5 text-xs text-zinc-700 transition active:scale-95 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:border-indigo-500/60 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-200"
                    >
                      {p.length > 18 ? `${p.slice(0, 18)}…` : p}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="hidden sm:block" />
              )}
              <button
                type="button"
                onClick={handleOptimize}
                disabled={!prompt.trim() || optimizing || loading}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 self-start rounded-full border border-indigo-200 bg-indigo-50/70 px-3.5 text-xs font-medium text-indigo-700 transition active:scale-95 hover:border-indigo-300 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:border-indigo-400/60 dark:hover:bg-indigo-500/20"
              >
                {optimizing ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    优化中…
                  </>
                ) : (
                  <>✨ 优化提示词</>
                )}
              </button>
            </div>
          </label>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                尺寸
              </span>
              <Select
                value={size}
                onChange={setSize}
                size="large"
                options={SIZE_OPTIONS}
                placeholder="选择尺寸"
                className="w-full"
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                质量
              </span>
              <Select
                value={quality}
                onChange={setQuality}
                size="large"
                options={QUALITY_OPTIONS}
                placeholder="选择质量"
                className="w-full"
              />
            </div>

            {size === "custom" && (
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 p-3 dark:border-indigo-500/30 dark:bg-indigo-500/5">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    宽度（px）
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={CUSTOM_SIZE_MIN}
                    max={CUSTOM_SIZE_MAX}
                    step={64}
                    value={customWidth}
                    onChange={(e) => setCustomWidth(Number(e.target.value) || 0)}
                    onBlur={(e) =>
                      setCustomWidth(clampSide(Number(e.target.value)))
                    }
                    className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    高度（px）
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={CUSTOM_SIZE_MIN}
                    max={CUSTOM_SIZE_MAX}
                    step={64}
                    value={customHeight}
                    onChange={(e) => setCustomHeight(Number(e.target.value) || 0)}
                    onBlur={(e) =>
                      setCustomHeight(clampSide(Number(e.target.value)))
                    }
                    className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </label>
                <p className="col-span-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                  范围 {CUSTOM_SIZE_MIN}–{CUSTOM_SIZE_MAX}px，建议 64 的倍数。
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-zinc-200/70 pt-4 dark:border-zinc-800/70 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-zinc-500 dark:text-zinc-500">
              单张约 30 秒 – 2 分钟，请保持页面打开。
            </span>
            <button
              type="submit"
              disabled={
                loading ||
                uploading ||
                !prompt.trim() ||
                (mode === Mode.Edit &&
                  imageSource === ImageSource.Upload &&
                  uploadedImages.length === 0) ||
                (mode === Mode.Edit &&
                  imageSource === ImageSource.Url &&
                  parsedExternalUrls.length === 0)
              }
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-6 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 transition active:scale-[0.98] hover:shadow-purple-500/40 disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:w-auto"
            >
              {loading ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                  {mode === Mode.Edit ? "正在编辑…" : "正在绘制…"}
                </>
              ) : (
                <>✨ {mode === Mode.Edit ? "编辑图片" : "生成图片"}</>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50/80 px-5 py-4 text-sm text-red-700 backdrop-blur dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            <strong className="font-semibold">出错了：</strong> {error}
          </div>
        )}

        {result && renderedItems.length > 0 && (
          <section className="flex flex-col gap-5">
            <ResultMeta result={result} />
            <div
              className={`grid gap-4 ${
                renderedItems.length > 1
                  ? "grid-cols-1 md:grid-cols-2"
                  : "grid-cols-1"
              }`}
            >
              {renderedItems.map((item, idx) => (
                <ResultCard
                  key={idx}
                  index={idx}
                  item={item}
                  createdAt={result.created}
                />
              ))}
            </div>
          </section>
        )}

        {!result && !error && !loading && (
          <div className="glass flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-2xl px-5 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400 sm:min-h-[180px] sm:rounded-3xl sm:px-6 sm:py-10">
            <span className="text-3xl">🎨</span>
            <p className="px-2">还没有作品。先写一段 prompt，点击「生成图片」开始吧。</p>
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

function ResultMeta({ result }: { result: ImagesGenerationsResponse }) {
  const usage = result.usage;
  return (
    <div className="glass flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl p-3 text-xs text-zinc-600 dark:text-zinc-400 sm:gap-x-6 sm:p-4">
      <MetaPill label="模型" value={result.model ?? "-"} />
      <MetaPill label="尺寸" value={result.size ?? "-"} />
      {result.quality && <MetaPill label="质量" value={result.quality} />}
      {result.output_format && (
        <MetaPill label="格式" value={String(result.output_format).toUpperCase()} />
      )}
      {usage && <UsageInfo usage={usage} />}
    </div>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-zinc-500 dark:text-zinc-500">{label}</span>
      <span className="font-medium text-zinc-800 dark:text-zinc-200">{value}</span>
    </span>
  );
}

function UsageInfo({ usage }: { usage: ImageUsage }) {
  return (
    <span className="inline-flex w-full items-center gap-1.5 rounded-full bg-zinc-100/80 px-2.5 py-1 dark:bg-zinc-800/60 sm:ml-auto sm:w-auto">
      <span className="text-zinc-500 dark:text-zinc-500">tokens</span>
      <span className="font-medium text-zinc-800 dark:text-zinc-200">
        输入 {usage.input_tokens} · 输出 {usage.output_tokens} · 总 {usage.total_tokens}
      </span>
    </span>
  );
}

function ResultCard({
  item,
  index,
  createdAt,
}: {
  item: RenderedItem;
  index: number;
  createdAt: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const fileName = `image-${createdAt}-${index + 1}.${item.ext}`;

  return (
    <figure className="glass overflow-hidden rounded-2xl sm:rounded-3xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.src}
        alt={`生成结果 ${index + 1}`}
        className="block h-auto w-full"
      />
      <figcaption className="flex flex-col gap-3 p-4 sm:px-5 sm:py-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            #{index + 1} 作品
          </span>
          <a
            href={item.src}
            download={fileName}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 text-xs font-medium text-white transition active:scale-95 hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            ↓ 下载
          </a>
        </div>

        {item.revisedPrompt && (
          <details
            open={expanded}
            onToggle={(e) => setExpanded((e.target as HTMLDetailsElement).open)}
            className="group rounded-xl border border-zinc-200/80 bg-white/50 p-3 text-xs leading-relaxed text-zinc-600 transition dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300"
          >
            <summary className="cursor-pointer list-none font-medium text-zinc-700 marker:hidden dark:text-zinc-200">
              <span className="inline-flex items-center gap-1.5">
                <span className="transition group-open:rotate-90">▸</span>
                模型改写后的 Prompt
              </span>
            </summary>
            <p className="mt-2 whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">
              {item.revisedPrompt}
            </p>
          </details>
        )}
      </figcaption>
    </figure>
  );
}
