"use client";

import { Timer } from "lucide-react";

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
    <div className="flex flex-col gap-3 border-t border-zinc-200/70 pt-4 dark:border-zinc-800/70 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs text-zinc-500 dark:text-zinc-500">
        {loading ? (
          <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums text-indigo-600 dark:text-indigo-300">
              <Timer className="h-3.5 w-3.5 animate-pulse" />
              已用 {formatDuration(elapsedMs)}
            </span>
            <span>· 单张约 30 秒 – 2 分钟，请保持页面打开。</span>
          </span>
        ) : lastDurationMs !== null ? (
          <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className="inline-flex items-center gap-1.5 font-medium tabular-nums text-zinc-700 dark:text-zinc-300">
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
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-6 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 transition active:scale-[0.98] hover:shadow-purple-500/40 disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:w-auto"
      >
        {loading ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
            {mode === Mode.Edit ? "正在编辑" : "正在绘制"}
            <span className="tabular-nums">{formatDuration(elapsedMs)}</span>
          </>
        ) : needCustomApi ? (
          <>🔑 请先填写 API</>
        ) : (
          <>✨ {mode === Mode.Edit ? "编辑图片" : "生成图片"}</>
        )}
      </button>
    </div>
  );
}
