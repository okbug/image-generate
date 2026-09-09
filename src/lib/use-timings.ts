"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * 出图耗时记录。只存在浏览器 localStorage 里，不上传服务端。
 * 结构和 use-custom-api 一样：快照存原始字符串，解析后再给组件用。
 */
const STORAGE_KEY = "image-generator:timings";
const MAX_ENTRIES = 12;

export type TimingEntry = {
  id: string;
  /** generate = 文生图，edit = 参考图重绘 */
  mode: "generate" | "edit";
  model: string;
  size: string;
  ms: number;
  /** 完成时刻（毫秒时间戳） */
  at: number;
  ok: boolean;
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", cb);
  }
  return () => {
    listeners.delete(cb);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", cb);
    }
  };
}

function getRawSnapshot(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

function parseEntries(raw: string | null): TimingEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is TimingEntry => {
        const e = item as Partial<TimingEntry>;
        return (
          typeof e?.id === "string" &&
          (e.mode === "generate" || e.mode === "edit") &&
          typeof e.model === "string" &&
          typeof e.size === "string" &&
          typeof e.ms === "number" &&
          typeof e.at === "number"
        );
      })
      .map((entry) => ({ ...entry, ok: Boolean(entry.ok) }))
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

function write(entries: TimingEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // 忽略存储失败（隐私模式 / 配额满）
  }
  notify();
}

export function useTimings() {
  const raw = useSyncExternalStore(subscribe, getRawSnapshot, getServerSnapshot);
  const entries = useMemo(() => parseEntries(raw), [raw]);

  const add = useCallback((entry: Omit<TimingEntry, "id" | "at">) => {
    const next: TimingEntry[] = [
      {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        at: Date.now(),
      },
      ...parseEntries(getRawSnapshot()),
    ].slice(0, MAX_ENTRIES);
    write(next);
  }, []);

  const clear = useCallback(() => write([]), []);

  /** 按模型算平均耗时，只统计成功的那些 */
  const averages = useMemo(() => {
    const buckets = new Map<string, { total: number; count: number }>();
    entries
      .filter((entry) => entry.ok)
      .forEach((entry) => {
        const bucket = buckets.get(entry.model) ?? { total: 0, count: 0 };
        bucket.total += entry.ms;
        bucket.count += 1;
        buckets.set(entry.model, bucket);
      });
    return Array.from(buckets.entries())
      .map(([model, { total, count }]) => ({
        model,
        count,
        avgMs: Math.round(total / count),
      }))
      .sort((a, b) => a.avgMs - b.avgMs);
  }, [entries]);

  return { entries, add, clear, averages };
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  return `${mins}分${Math.round(seconds - mins * 60)}秒`;
}

export function formatRelativeTime(at: number, now: number): string {
  const diff = Math.max(0, now - at);
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${Math.floor(diff / 86_400_000)} 天前`;
}
