"use client";

import { useCallback, useEffect, useState } from "react";

import type { ActivationStatus } from "@/lib/activation-shared";
import { verifyActivationCode } from "@/lib/use-custom-api";

export function isQuotaExceeded(status: ActivationStatus | null): boolean {
  return status !== null && status.usedToday >= status.dailyLimit;
}

/**
 * 官方生图的今日额度：开启时拉取，每次出图结束和切回页面时刷新（可能已过北京时间 0 点）。
 * 传空串表示没有开启，status 恒为 null。
 */
export function useOfficialQuota(code: string, busy: boolean) {
  const [fetched, setFetched] = useState<ActivationStatus | null>(null);

  const refresh = useCallback(async () => {
    const result = await verifyActivationCode(code);
    setFetched("error" in result ? null : result);
    return result;
  }, [code]);

  useEffect(() => {
    if (!code || busy) return;
    void Promise.resolve().then(refresh);
    const handleFocus = () => void refresh();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [busy, code, refresh]);

  return { status: code ? fetched : null, refresh };
}
