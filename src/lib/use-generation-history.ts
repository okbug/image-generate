"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "image-generator:history";
/** 「保留记录」开关；没有值视为开启。 */
const ENABLED_KEY = "image-generator:history-enabled";

/** 最多保留的条数；超出时只丢掉最旧的本地记录，图床里的图不动。 */
export const MAX_HISTORY = 50;

/** 「最近生成」里的一条记录，只存图床 URL 和元信息，不存图片本身。 */
export type HistoryEntry = {
  id: string;
  url: string;
  storeKey: string;
  deleteToken: string;
  prompt: string;
  model: string;
  size: string;
  mode: "generate" | "edit";
  bytes?: number;
  createdAt: number;
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (typeof window !== "undefined") {
    // 跨 tab 同步
    window.addEventListener("storage", cb);
  }
  return () => {
    listeners.delete(cb);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", cb);
    }
  };
}

function readKey(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function getRawSnapshot(): string | null {
  return readKey(STORAGE_KEY);
}

function getEnabledSnapshot(): boolean {
  return readKey(ENABLED_KEY) !== "0";
}

function getEnabledServerSnapshot(): boolean {
  return true;
}

function getServerSnapshot(): string | null {
  return null;
}

function isEntry(value: unknown): value is HistoryEntry {
  const e = value as Partial<HistoryEntry> | null;
  return (
    typeof e?.id === "string" &&
    typeof e.url === "string" &&
    typeof e.storeKey === "string" &&
    typeof e.deleteToken === "string" &&
    typeof e.createdAt === "number"
  );
}

function parseEntries(raw: string | null): HistoryEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

function writeKey(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 忽略存储失败
  }
  notify();
}

function write(entries: HistoryEntry[]) {
  writeKey(STORAGE_KEY, JSON.stringify(entries));
}

/** 最近生成的图片（新的在前），存在 localStorage。 */
export function useGenerationHistory() {
  const raw = useSyncExternalStore(
    subscribe,
    getRawSnapshot,
    getServerSnapshot,
  );
  const entries = useMemo(() => parseEntries(raw), [raw]);
  const enabled = useSyncExternalStore(
    subscribe,
    getEnabledSnapshot,
    getEnabledServerSnapshot,
  );

  const setEnabled = useCallback((next: boolean) => {
    writeKey(ENABLED_KEY, next ? "1" : "0");
  }, []);

  const add = useCallback((next: HistoryEntry[]) => {
    if (next.length === 0) return;
    const current = parseEntries(getRawSnapshot());
    write([...next, ...current].slice(0, MAX_HISTORY));
  }, []);

  const remove = useCallback((id: string) => {
    const current = parseEntries(getRawSnapshot());
    write(current.filter((e) => e.id !== id));
  }, []);

  return { entries, add, remove, enabled, setEnabled };
}
