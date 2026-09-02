"use client";

import { useCallback, useEffect, useState } from "react";

import type { MeResponse, PublicPrices, SessionUser } from "@/types/auth";

type AuthState = {
  loading: boolean;
  user: SessionUser | null;
  prices: PublicPrices | null;
};

/** 读取当前登录用户与公开定价；余额变动后用 setBalance 局部更新 */
export function useAuth() {
  const [state, setState] = useState<AuthState>({
    loading: true,
    user: null,
    prices: null,
  });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as MeResponse;
      setState({ loading: false, user: json.user, prices: json.prices });
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  // 挂载时拉一次远端登录态。refresh 内的 setState 都发生在 await 之后，
  // 不会造成级联同步渲染；规则无法跨函数分析，故在此显式放行。
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const setBalance = useCallback((balance: number) => {
    setState((s) => (s.user ? { ...s, user: { ...s.user, balance } } : s));
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // 网络失败也按已登出处理
    }
    setState((s) => ({ ...s, user: null }));
  }, []);

  return { ...state, refresh, setBalance, logout };
}
