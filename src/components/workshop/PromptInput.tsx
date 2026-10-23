"use client";

import { Mode, PROMPT_PRESETS } from "./constants";

/** Prompt 输入框 + 示例提示词 + 优化 / 撤销优化按钮。 */
export function PromptInput({
  prompt,
  setPrompt,
  mode,
  optimizing,
  loading,
  customApiActive,
  canToggleOptimize,
  optimizeUndone,
  handleOptimize,
  handleToggleOptimize,
}: {
  prompt: string;
  setPrompt: (value: string) => void;
  mode: Mode;
  optimizing: boolean;
  loading: boolean;
  customApiActive: boolean;
  canToggleOptimize: boolean;
  optimizeUndone: boolean;
  handleOptimize: () => void;
  handleToggleOptimize: () => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-sand-800 dark:text-sand-200">
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
        className="w-full resize-y rounded-xl border border-sand-200 bg-white/80 px-3.5 py-3 text-base leading-relaxed text-sand-900 outline-none transition placeholder:text-sand-400 focus:border-clay-400 focus:bg-white focus:ring-4 focus:ring-clay-400/10 disabled:opacity-60 sm:text-sm dark:border-sand-700 dark:bg-sand-900/60 dark:text-sand-100 dark:placeholder:text-sand-500 dark:focus:border-clay-400 dark:focus:bg-sand-900"
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {mode === Mode.Generate ? (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pt-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            {PROMPT_PRESETS.map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => setPrompt(p)}
                className="shrink-0 whitespace-nowrap rounded-full border border-sand-200 bg-white/70 px-3 py-1.5 text-xs text-sand-700 transition active:scale-95 hover:border-clay-300 hover:bg-clay-50 hover:text-clay-700 dark:border-sand-700 dark:bg-sand-900/60 dark:text-sand-300 dark:hover:border-clay-500/60 dark:hover:bg-clay-500/10 dark:hover:text-clay-200"
              >
                {p.length > 18 ? `${p.slice(0, 18)}…` : p}
              </button>
            ))}
          </div>
        ) : (
          <span className="hidden sm:block" />
        )}
        <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
          {canToggleOptimize && (
            <button
              type="button"
              onClick={handleToggleOptimize}
              disabled={optimizing || loading}
              title={
                optimizeUndone ? "换回优化后的提示词" : "换回优化前你写的提示词"
              }
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-sand-200 bg-white/70 px-3.5 text-xs font-medium text-sand-600 transition active:scale-95 hover:border-sand-300 hover:bg-sand-50 hover:text-sand-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sand-700 dark:bg-sand-900/60 dark:text-sand-300 dark:hover:border-sand-600 dark:hover:bg-sand-800 dark:hover:text-sand-100"
            >
              {optimizeUndone ? "↷ 恢复优化" : "↶ 撤销优化"}
            </button>
          )}
          <button
            type="button"
            onClick={handleOptimize}
            disabled={
              !customApiActive || !prompt.trim() || optimizing || loading
            }
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-clay-200 bg-clay-50/70 px-3.5 text-xs font-medium text-clay-700 transition active:scale-95 hover:border-clay-300 hover:bg-clay-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-clay-500/40 dark:bg-clay-500/10 dark:text-clay-300 dark:hover:border-clay-400/60 dark:hover:bg-clay-500/20"
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
      </div>
    </label>
  );
}
