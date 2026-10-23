"use client";

import { useEffect, useState } from "react";

import { Timer, Trash2 } from "lucide-react";

import {
  type TimingEntry,
  formatDuration,
  formatRelativeTime,
} from "@/lib/use-timings";

export function TimingPanel({
  entries,
  averages,
  onClear,
}: {
  entries: TimingEntry[];
  averages: Array<{ model: string; count: number; avgMs: number }>;
  onClear: () => void;
}) {
  // 相对时间每 30 秒刷新一次，不然「刚刚」会一直挂着
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="glass flex flex-col gap-3 rounded-2xl p-4 sm:rounded-3xl sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-sand-800 dark:text-sand-200">
          <span className="inline-flex items-center gap-1.5">
            <Timer className="h-4 w-4 text-clay-500" />
            出图耗时记录
          </span>
          <span className="text-xs font-normal text-sand-500 dark:text-sand-500">
            最近 {entries.length} 次，只存在本机浏览器
          </span>
        </span>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-sand-200 bg-white/70 px-3 text-xs text-sand-600 transition active:scale-95 hover:border-red-300 hover:text-red-600 dark:border-sand-700 dark:bg-sand-900/60 dark:text-sand-300 dark:hover:border-red-500/50 dark:hover:text-red-300"
        >
          <Trash2 className="h-3.5 w-3.5" />
          清空
        </button>
      </div>

      {averages.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {averages.map((item) => (
            <span
              key={item.model}
              className="inline-flex items-center gap-1.5 rounded-full bg-clay-50/80 px-2.5 py-1 text-[11px] text-clay-700 dark:bg-clay-500/10 dark:text-clay-200"
            >
              {item.model}
              <span className="font-semibold tabular-nums">
                {formatDuration(item.avgMs)}
              </span>
              <span className="text-clay-500/80 dark:text-clay-300/70">
                均值 · {item.count} 次
              </span>
            </span>
          ))}
        </div>
      )}

      <ul className="flex flex-col divide-y divide-sand-200/70 dark:divide-sand-800/70">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="flex items-center justify-between gap-3 py-2 text-xs"
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-medium text-sand-800 dark:text-sand-200">
                {entry.model}
                <span className="ml-1.5 font-normal text-sand-500 dark:text-sand-500">
                  {entry.mode === "edit" ? "编辑" : "生成"} · {entry.size}
                </span>
              </span>
              <span className="text-sand-500 dark:text-sand-500">
                {formatRelativeTime(entry.at, now)}
              </span>
            </span>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 font-semibold tabular-nums ${
                entry.ok
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300"
              }`}
            >
              {entry.ok
                ? formatDuration(entry.ms)
                : `失败 · ${formatDuration(entry.ms)}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
