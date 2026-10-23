"use client";

import { Settings } from "lucide-react";

import { MAX_UPLOAD_COUNT, MODE_OPTIONS, Mode } from "./constants";

export function PageHeader({
  mode,
  model,
  loading,
  uploading,
  customApiActive,
  needCustomApi,
  handleSwitchMode,
  onOpenSettings,
}: {
  mode: Mode;
  model: string;
  loading: boolean;
  uploading: boolean;
  customApiActive: boolean;
  needCustomApi: boolean;
  handleSwitchMode: (next: Mode) => void;
  onOpenSettings: () => void;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col items-start gap-2.5 md:gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-sand-200/70 bg-white/60 px-3 py-1 text-[11px] font-medium text-sand-700 backdrop-blur dark:border-sand-700/60 dark:bg-sand-900/50 dark:text-sand-300 md:text-xs">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          模型 {model} · {mode === Mode.Edit ? "图像编辑" : "实时生成"}
        </span>
        <h1 className="brand-title text-3xl md:text-5xl">AI 图片工坊</h1>
        <p className="max-w-xl text-sm leading-relaxed text-sand-600 dark:text-sand-400 md:text-base">
          {mode === Mode.Edit
            ? `上传最多 ${MAX_UPLOAD_COUNT} 张参考图，描述想要的修改，由模型重绘。`
            : "把你脑中的画面写下来，几秒后就能拿到一张高清成片。"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-start">
        <div className="flex h-10 items-center gap-1 rounded-full border border-sand-200/80 bg-white/70 p-1 backdrop-blur dark:border-sand-700/70 dark:bg-sand-900/60">
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSwitchMode(opt.value)}
              disabled={loading || uploading}
              className={`inline-flex h-full items-center justify-center rounded-full px-4 text-xs font-medium transition active:scale-95 disabled:cursor-not-allowed ${
                mode === opt.value
                  ? "bg-sand-900 text-sand-50 shadow-sm dark:bg-sand-100 dark:text-sand-900"
                  : "text-sand-600 hover:text-sand-900 dark:text-sand-300 dark:hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          title="API 与模型设置"
          className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full border bg-white/70 text-base backdrop-blur transition active:scale-95 hover:border-clay-300 dark:bg-sand-900/60 ${
            customApiActive
              ? "border-clay-300 text-clay-600 dark:border-clay-500/60 dark:text-clay-300"
              : "border-sand-200/80 text-sand-600 dark:border-sand-700/70 dark:text-sand-300"
          }`}
        >
          <Settings className="h-4.5 w-4.5" />
          {customApiActive && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-sand-900" />
          )}
          {needCustomApi && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 animate-pulse rounded-full bg-clay-500 ring-2 ring-white dark:ring-sand-900" />
          )}
        </button>
      </div>
    </header>
  );
}
