"use client";

import { useCallback, useEffect, useState } from "react";

import type { ActivationStatus } from "@/lib/activation-shared";
import { verifyActivationCode } from "@/lib/use-custom-api";

export function isQuotaExceeded(status: ActivationStatus | null): boolean {
  return status !== null && status.usedToday >= status.dailyLimit;
}

/**
 * 校验激活码并拉取今日额度，每次出图结束和切回页面时刷新。
 * 即使关闭普通生图的官方线路，也用于判断动图入口是否可见。
 * 传空串表示没有激活码，status 恒为 null。
 */
export function useOfficialQuota(code: string, busy: boolean) {
  const [fetched, setFetched] = useState<{
    code: string;
    status: ActivationStatus | null;
  } | null>(null);

  const refresh = useCallback(async () => {
    const result = await verifyActivationCode(code);
    setFetched({ code, status: "error" in result ? null : result });
    return result;
  }, [code]);

  useEffect(() => {
    if (!code || busy) return;
    void Promise.resolve().then(refresh);
    const handleFocus = () => void refresh();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [busy, code, refresh]);

  return {
    status: code && fetched?.code === code ? fetched.status : null,
    refresh,
  };
}
