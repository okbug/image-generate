"use client";

import Link from "next/link";
import { LogOut, ShieldCheck, UserRound, Wallet } from "lucide-react";

import { formatCents } from "@/lib/money";
import type { SessionUser } from "@/types/auth";

type Props = {
  user: SessionUser | null;
  loading: boolean;
  onLogout: () => void;
};

const pillBase =
  "inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium backdrop-blur transition active:scale-95";
const pillNeutral =
  "border-zinc-200/80 bg-white/70 text-zinc-700 hover:border-indigo-300 hover:text-indigo-700 dark:border-zinc-700/70 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:border-indigo-500/60 dark:hover:text-indigo-200";
const iconButton =
  "inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200/80 bg-white/70 text-zinc-600 backdrop-blur transition active:scale-95 hover:border-indigo-300 hover:text-indigo-600 dark:border-zinc-700/70 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:border-indigo-500/60 dark:hover:text-indigo-300";

export function UserBar({ user, loading, onLogout }: Props) {
  if (loading) {
    return (
      <div className="h-10 w-32 animate-pulse rounded-full bg-zinc-200/60 dark:bg-zinc-800/60" />
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/login" className={`${pillBase} ${pillNeutral}`}>
          登录
        </Link>
        <Link
          href="/register"
          className={`${pillBase} border-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-sm hover:shadow-purple-500/30`}
        >
          注册
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div
        className={`${pillBase} border-zinc-200/80 bg-white/70 text-zinc-700 dark:border-zinc-700/70 dark:bg-zinc-900/60 dark:text-zinc-300`}
        title={`用户 ${user.username}`}
      >
        <UserRound className="h-3.5 w-3.5 text-indigo-500" />
        <span className="max-w-[7rem] truncate">{user.username}</span>
        <span className="h-3 w-px bg-zinc-300 dark:bg-zinc-700" />
        <Wallet className="h-3.5 w-3.5 text-emerald-500" />
        <span className="tabular-nums">{formatCents(user.balance)}</span>
      </div>
      {user.role === "admin" && (
        <Link href="/admin" title="管理后台" className={iconButton}>
          <ShieldCheck className="h-4 w-4" />
        </Link>
      )}
      <button
        type="button"
        onClick={onLogout}
        title="退出登录"
        className={iconButton}
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
