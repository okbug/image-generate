"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "image-generator:history";
/** 「保留记录」开关；没有值视为开启。 */
const ENABLED_KEY = "image-generator:history-enabled";

/** 最多保留的条数；超出时自动删除最旧的图片（本地记录 + 图床文件）。 */
export const MAX_HISTORY = 200;

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

/**
 * 本页会话里已经从图床删掉的 storeKey（只在内存里）。结果区据此禁用「编辑该图片」等，
 * 免得点了去拉一张 404 的图。每次变更换一个新 Set，useSyncExternalStore 才能感知。
 */
let deletedKeys: ReadonlySet<string> = new Set();
const EMPTY_KEYS: ReadonlySet<string> = new Set();

function markDeleted(storeKey: string) {
  deletedKeys = new Set([...deletedKeys, storeKey]);
  notify();
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

/** 删除图床里的一张出图结果，成功返回 null，失败返回错误文案。 */
export async function deleteGeneratedImage(
  entry: HistoryEntry,
): Promise<string | null> {
  try {
    const res = await fetch("/api/generated", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeKey: entry.storeKey,
        deleteToken: entry.deleteToken,
      }),
    });
    if (res.ok) {
      markDeleted(entry.storeKey);
      return null;
    }
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    return json.error ?? `删除失败 (${res.status})`;
  } catch (err) {
    return err instanceof Error ? err.message : "删除失败";
  }
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

  const deleted = useSyncExternalStore(
    subscribe,
    () => deletedKeys,
    () => EMPTY_KEYS,
  );

  const setEnabled = useCallback((next: boolean) => {
    writeKey(ENABLED_KEY, next ? "1" : "0");
  }, []);

  const add = useCallback((next: HistoryEntry[]) => {
    if (next.length === 0) return;
    const combined = [...next, ...parseEntries(getRawSnapshot())];
    write(combined.slice(0, MAX_HISTORY));
    // 超出上限的最旧记录：连图床文件一起删掉，免得记录没了、图却删不掉。
    // 后台尽力而为，失败只打日志（凭证随记录一起丢了，之后也删不了）。
    for (const entry of combined.slice(MAX_HISTORY)) {
      void deleteGeneratedImage(entry).then((error) => {
        if (error)
          console.warn("[history] 自动删除旧图失败", entry.storeKey, error);
      });
    }
  }, []);

  const remove = useCallback((id: string) => {
    const current = parseEntries(getRawSnapshot());
    write(current.filter((e) => e.id !== id));
  }, []);

  /**
   * 一键清空：逐张删图床文件，成功一张移除一张本地记录，失败的留下方便重试。
   * 返回删除失败的张数。
   */
  const clearAll = useCallback(async (): Promise<number> => {
    let failed = 0;
    for (const entry of parseEntries(getRawSnapshot())) {
      const error = await deleteGeneratedImage(entry);
      if (error) {
        failed += 1;
        continue;
      }
      write(parseEntries(getRawSnapshot()).filter((e) => e.id !== entry.id));
    }
    return failed;
  }, []);

  return {
    entries,
    add,
    remove,
    clearAll,
    enabled,
    setEnabled,
    deletedKeys: deleted,
  };
}
