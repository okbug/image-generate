"use client";

import {
  Image,
  Progress,
  Upload,
  type UploadFile,
  type UploadProps,
} from "antd";
import { ClipboardPaste, ImagePlus, UploadCloud, X } from "lucide-react";

import {
  IMAGE_SOURCE_OPTIONS,
  ImageSource,
  MAX_UPLOAD_COUNT,
  MAX_UPLOAD_SIZE,
  type UploadedImage,
} from "./constants";

/** 编辑模式下的参考图区域：上传图片 / 填写图片 URL 两种来源。 */
export function ReferenceImagesInput({
  imageSource,
  onSwitchSource,
  loading,
  uploading,
  uploadProps,
  uploadedImages,
  uploadFileList,
  onRemoveImage,
  externalUrl,
  setExternalUrl,
  parsedExternalUrls,
}: {
  imageSource: ImageSource;
  onSwitchSource: (next: ImageSource) => void;
  loading: boolean;
  uploading: boolean;
  uploadProps: UploadProps;
  uploadedImages: UploadedImage[];
  uploadFileList: UploadFile[];
  onRemoveImage: (uid: string) => void;
  externalUrl: string;
  setExternalUrl: (value: string) => void;
  parsedExternalUrls: string[];
}) {
  const pendingFiles = uploadFileList.filter(
    (file) => file.status === "uploading",
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-sand-800 dark:text-sand-200">
          参考图片
        </span>
        <div className="flex h-8 shrink-0 items-center gap-1 rounded-full border border-sand-200/80 bg-white/70 p-0.5 backdrop-blur dark:border-sand-700/70 dark:bg-sand-900/60">
          {IMAGE_SOURCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSwitchSource(opt.value)}
              disabled={loading || uploading}
              className={`inline-flex h-full items-center justify-center rounded-full px-3 text-xs font-medium transition active:scale-95 disabled:cursor-not-allowed ${
                imageSource === opt.value
                  ? "bg-sand-900 text-white shadow-sm dark:bg-white dark:text-sand-900"
                  : "text-sand-600 hover:text-sand-900 dark:text-sand-300 dark:hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-clay-200 bg-clay-50/80 px-3 py-2.5 text-xs leading-relaxed text-clay-800 backdrop-blur dark:border-clay-700/40 dark:bg-clay-500/10 dark:text-clay-200">
        <span className="font-semibold">⚠️ 隐私提示：</span>
        请勿上传涉及隐私、身份信息或敏感内容的图片。你上传的图片会临时保存在本网站约
        30 分钟，
        用于发起编辑请求；网站设有定时清理机制，过期文件会被自动删除，请放心使用。
      </div>

      {imageSource === ImageSource.Upload ? (
        <div className="flex flex-col gap-3">
          <Upload.Dragger {...uploadProps} className="reference-upload">
            <div className="flex flex-col items-center gap-2 px-4 py-3 text-center">
              {uploading ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-clay-500 border-t-transparent" />
              ) : (
                <UploadCloud className="h-7 w-7 text-clay-500" />
              )}
              <span className="text-sm font-medium text-sand-800 dark:text-sand-100">
                点击、拖拽或粘贴参考图片
              </span>
              <span className="text-xs leading-relaxed text-sand-500 dark:text-sand-400">
                支持 PNG / JPG / WebP，单张最大 {MAX_UPLOAD_SIZE / 1024 / 1024}
                MB，最多 {MAX_UPLOAD_COUNT} 张
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-sand-500 dark:text-sand-500">
                <ClipboardPaste className="h-3.5 w-3.5" />
                复制图片后在此区域按 Ctrl / Cmd + V
              </span>
            </div>
          </Upload.Dragger>

          {pendingFiles.length > 0 && (
            <div className="flex flex-col gap-2">
              {pendingFiles.map((file) => {
                const percent = file.percent ?? 0;
                return (
                  <div
                    key={file.uid}
                    className="rounded-xl border border-sand-200 bg-white/70 px-3 py-2 dark:border-sand-700 dark:bg-sand-900/50"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-sand-700 dark:text-sand-300">
                        {file.name}
                      </span>
                      <span className="shrink-0 text-sand-500 dark:text-sand-500">
                        {percent >= 100 ? "处理中…" : `${percent}%`}
                      </span>
                    </div>
                    <Progress
                      percent={percent}
                      size="small"
                      showInfo={false}
                      status="active"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {uploadedImages.length > 0 && (
            <Image.PreviewGroup>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {uploadedImages.map((image, idx) => (
                  <div
                    key={image.uid}
                    className="group relative overflow-hidden rounded-xl border border-sand-200 bg-white/70 dark:border-sand-700 dark:bg-sand-900/50"
                  >
                    <Image
                      src={image.previewSrc}
                      alt={`已上传参考图 ${idx + 1}`}
                      className="!h-36 !w-full object-cover"
                      preview={{ mask: "预览" }}
                    />
                    <button
                      type="button"
                      onClick={() => onRemoveImage(image.uid)}
                      disabled={loading}
                      title="移除图片"
                      className="absolute top-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-sand-950/70 text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="flex flex-col gap-1 px-3 py-2 text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-sand-800 dark:text-sand-200">
                        <ImagePlus className="h-3.5 w-3.5" />
                        参考图 {idx + 1}
                      </span>
                      <span className="truncate text-sand-500 dark:text-sand-500">
                        {image.name || image.fileName}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Image.PreviewGroup>
          )}

          <p className="text-[11px] text-sand-500 dark:text-sand-500">
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
            className="w-full resize-y rounded-xl border border-sand-200 bg-white/80 px-3.5 py-3 text-sm leading-relaxed text-sand-900 outline-none transition placeholder:text-sand-400 focus:border-clay-400 focus:ring-4 focus:ring-clay-400/10 dark:border-sand-700 dark:bg-sand-900/60 dark:text-sand-100 dark:placeholder:text-sand-500"
          />
          <div className="flex flex-col gap-1 text-[11px] text-sand-500 dark:text-sand-500">
            <p>
              可一次填写最多 {MAX_UPLOAD_COUNT} 个图片
              URL，用英文逗号、中文逗号或换行分隔。
            </p>
            <p>
              URL 必须公网可达，模型服务端将通过地址拉取图片，本网站不会暂存它。
            </p>
          </div>
          {parsedExternalUrls.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 text-[11px] text-sand-500 dark:text-sand-500">
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
                {parsedExternalUrls
                  .slice(0, MAX_UPLOAD_COUNT)
                  .map((url, idx) => (
                    <div
                      key={url}
                      className="overflow-hidden rounded-xl border border-sand-200 bg-white/70 dark:border-sand-700 dark:bg-sand-900/50"
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
                        <span className="font-medium text-sand-800 dark:text-sand-200">
                          URL 参考图 {idx + 1}
                        </span>
                        <span className="truncate text-sand-500 dark:text-sand-500">
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
  );
}
