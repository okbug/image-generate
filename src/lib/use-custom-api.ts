"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "image-generator:custom-api";

export type CustomApiSettings = {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  /** 优化提示词用的模型，留空表示用默认的 DEFAULT_OPTIMIZE_MODEL。与上面的凭证开关无关。 */
  optimizeModel: string;
};

const EMPTY_SETTINGS: CustomApiSettings = {
  enabled: false,
  baseUrl: "",
  apiKey: "",
  optimizeModel: "",
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

function parseSettings(raw: string | null): CustomApiSettings {
  if (!raw) return EMPTY_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<CustomApiSettings>;
    return {
      enabled: Boolean(parsed.enabled),
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : "",
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      optimizeModel:
        typeof parsed.optimizeModel === "string" ? parsed.optimizeModel : "",
    };
  } catch {
    return EMPTY_SETTINGS;
  }
}

function isActive(s: CustomApiSettings): boolean {
  return s.enabled && s.baseUrl.trim().length > 0 && s.apiKey.trim().length > 0;
}

export function useCustomApi() {
  const raw = useSyncExternalStore(subscribe, getRawSnapshot, getServerSnapshot);
  const settings = useMemo(() => parseSettings(raw), [raw]);

  const save = useCallback((next: CustomApiSettings) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // 忽略存储失败
    }
    notify();
  }, []);

  const buildHeaders = useCallback(
    (extra?: HeadersInit): Headers => {
      const headers = new Headers(extra);
      if (isActive(settings)) {
        headers.set("x-image-api-base-url", settings.baseUrl.trim());
        headers.set("x-image-api-key", settings.apiKey.trim());
      }
      return headers;
    },
    [settings],
  );

  return { settings, save, buildHeaders, active: isActive(settings) };
}
