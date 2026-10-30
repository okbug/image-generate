"use client";

import { App } from "antd";
import { Copy } from "lucide-react";

/** 上游报错多半是 JSON 字符串，能解析就缩进排版，否则原样显示。 */
function formatDetail(detail: string): string {
  try {
    return JSON.stringify(JSON.parse(detail), null, 2);
  } catch {
    return detail;
  }
}

/** 请求出错时的红色卡片：一行概述 + 上游返回的完整原始报错。 */
export function ErrorCard({
  message: errorMessage,
  detail,
}: {
  message: string;
  detail?: string;
}) {
  const { message } = App.useApp();
  const formatted = detail?.trim() ? formatDetail(detail.trim()) : null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(
        formatted ? `${errorMessage}\n\n${formatted}` : errorMessage,
      );
      void message.success("已复制报错信息");
    } catch {
      void message.error("复制失败，请手动选择文字复制");
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50/80 px-5 py-4 text-sm text-red-700 backdrop-blur dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
      <div className="flex items-start justify-between gap-3">
        <p className="break-all">
          <strong className="font-semibold">出错了：</strong>
          {errorMessage}
        </p>
        <button
          type="button"
          onClick={() => void handleCopy()}
          title="复制报错信息"
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-red-600 transition hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-500/15"
        >
          <Copy className="h-3.5 w-3.5" />
          复制
        </button>
      </div>
      {formatted && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-red-600/80 dark:text-red-300/80">
            上游返回的原始信息：
          </span>
          <pre className="max-h-72 overflow-auto rounded-lg border border-red-200/70 bg-white/60 p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-red-800 dark:border-red-900/50 dark:bg-black/30 dark:text-red-200">
            {formatted}
          </pre>
        </div>
      )}
    </div>
  );
}
