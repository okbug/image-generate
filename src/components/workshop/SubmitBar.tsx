"use client";

import { KeyRound, Sparkles, Timer } from "lucide-react";

import { formatDuration } from "@/lib/use-timings";

import { Mode } from "./constants";

/** 表单底部：耗时提示 + 生成 / 编辑按钮。 */
export function SubmitBar({
  mode,
  loading,
  elapsedMs,
  lastDurationMs,
  needCustomApi,
  disabled,
}: {
  mode: Mode;
  loading: boolean;
  elapsedMs: number;
  lastDurationMs: number | null;
  needCustomApi: boolean;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-sand-200/70 pt-4 dark:border-sand-800/70 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs text-sand-500 dark:text-sand-500">
        {loading ? (
          <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums text-clay-600 dark:text-clay-300">
              <Timer className="h-3.5 w-3.5 animate-pulse" />
              已用 {formatDuration(elapsedMs)}
            </span>
            <span>· 单张约 30 秒 – 2 分钟，请保持页面打开。</span>
          </span>
        ) : lastDurationMs !== null ? (
          <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className="inline-flex items-center gap-1.5 font-medium tabular-nums text-sand-700 dark:text-sand-300">
              <Timer className="h-3.5 w-3.5" />
              上次耗时 {formatDuration(lastDurationMs)}
            </span>
            <span>· 单张约 30 秒 – 2 分钟。</span>
          </span>
        ) : (
          "单张约 30 秒 – 2 分钟，请保持页面打开。"
        )}
      </span>
      <button
        type="submit"
        disabled={disabled}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-clay-600 dark:bg-clay-500 px-6 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] hover:bg-clay-700 dark:hover:bg-clay-400 disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:w-auto"
      >
        {loading ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
            {mode === Mode.Edit ? "正在编辑" : "正在绘制"}
            <span className="tabular-nums">{formatDuration(elapsedMs)}</span>
          </>
        ) : needCustomApi ? (
          <>
            <KeyRound className="h-4 w-4" />
            请先填写 API
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            {mode === Mode.Edit ? "编辑图片" : "生成图片"}
          </>
        )}
      </button>
    </div>
  );
}
