"use client";

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
        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200/70 bg-white/60 px-3 py-1 text-[11px] font-medium text-zinc-700 backdrop-blur dark:border-zinc-700/60 dark:bg-zinc-900/50 dark:text-zinc-300 md:text-xs">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          模型 {model} · {mode === Mode.Edit ? "图像编辑" : "实时生成"}
        </span>
        <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
          <span className="gradient-text">AI 图片工坊</span>
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 md:text-base">
          {mode === Mode.Edit
            ? `上传最多 ${MAX_UPLOAD_COUNT} 张参考图，描述想要的修改，由模型重绘。`
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
          onClick={onOpenSettings}
          title="API 与模型设置"
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
          {needCustomApi && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 animate-pulse rounded-full bg-amber-500 ring-2 ring-white dark:ring-zinc-900" />
          )}
        </button>
      </div>
    </header>
  );
}
