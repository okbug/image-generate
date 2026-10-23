"use client";

import { useEffect, useState } from "react";

import { Image } from "antd";
import {
  Clock,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Lock,
  RefreshCw,
  Unlock,
} from "lucide-react";

import type { TmpImageInfo } from "@/app/api/tmp-images/route";
import { formatRelativeTime } from "@/lib/use-timings";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDateTime(at: number): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatRemaining(expiresAt: number, now: number): string {
  const left = expiresAt - now;
  if (left <= 0) return "已过期，等待下次清理";
  return `约 ${Math.ceil(left / 60_000)} 分钟后自动清理`;
}

export default function TmpImagesPage() {
  const [password, setPassword] = useState("");
  // 解锁成功后记住密码，刷新列表时还要带上
  const [unlockedPassword, setUnlockedPassword] = useState<string | null>(null);
  const [images, setImages] = useState<TmpImageInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // 相对时间和剩余时间每 30 秒刷新一次
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  async function loadImages(pwd: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tmp-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });
      const json = (await res.json()) as {
        images?: TmpImageInfo[];
        error?: string;
      };
      if (!res.ok || !json.images) {
        setError(json.error ?? `加载失败 (${res.status})`);
        if (res.status === 401) setUnlockedPassword(null);
        return;
      }
      setImages(json.images);
      setUnlockedPassword(pwd);
      setNow(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }

  function handleUnlock() {
    if (!password.trim() || loading) return;
    void loadImages(password);
  }

  function handleLock() {
    setUnlockedPassword(null);
    setPassword("");
    setImages([]);
    setError(null);
  }

  function handleCopy(url: string) {
    const fullUrl = `${window.location.origin}${url}`;
    navigator.clipboard
      .writeText(fullUrl)
      .then(() => {
        setCopied(url);
        window.setTimeout(
          () => setCopied((current) => (current === url ? null : current)),
          1500,
        );
      })
      .catch(() => setError("复制失败，请手动复制"));
  }

  return (
    <div className="min-h-screen px-4 py-6 md:px-8 md:py-14">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 md:gap-10">
        <header className="flex items-center gap-3">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-clay-600 dark:bg-clay-500 text-white shadow-sm">
            <ImageIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              <span className="brand-title">临时图片</span>
            </h1>
            <p className="text-sm text-sand-600 dark:text-sand-400">
              编辑模式上传的参考图，保存约 30 分钟后自动清理
            </p>
          </div>
        </header>

        {unlockedPassword === null ? (
          <div className="glass rounded-2xl p-6 sm:rounded-3xl sm:p-8">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 text-clay-600 dark:text-clay-400">
                <Lock className="h-5 w-5" />
                <span className="font-medium">需要密码验证</span>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="h-12 flex-1 rounded-xl border border-sand-200 bg-white/80 px-4 text-base text-sand-900 outline-none transition placeholder:text-sand-400 focus:border-clay-400 focus:ring-4 focus:ring-clay-400/10 dark:border-sand-700 dark:bg-sand-900/60 dark:text-sand-100 dark:placeholder:text-sand-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleUnlock();
                  }}
                />
                <button
                  type="button"
                  onClick={handleUnlock}
                  disabled={!password.trim() || loading}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-clay-600 dark:bg-clay-500 px-6 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] hover:bg-clay-700 dark:hover:bg-clay-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                  ) : (
                    <Unlock className="h-4 w-4" />
                  )}
                  解锁
                </button>
              </div>
              {error && (
                <p className="text-sm text-red-600 dark:text-red-300">
                  {error}
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-sand-600 dark:text-sand-400">
                共 {images.length} 张，按上传时间从新到旧
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadImages(unlockedPassword)}
                  disabled={loading}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-sand-200 bg-white/70 px-3 text-xs text-sand-700 transition active:scale-95 hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sand-700 dark:bg-sand-900/60 dark:text-sand-300 dark:hover:bg-sand-800"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                  />
                  刷新
                </button>
                <button
                  type="button"
                  onClick={handleLock}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-sand-200 bg-white/70 px-3 text-xs text-sand-700 transition active:scale-95 hover:bg-sand-100 dark:border-sand-700 dark:bg-sand-900/60 dark:text-sand-300 dark:hover:bg-sand-800"
                >
                  <Lock className="h-3.5 w-3.5" />
                  重新锁定
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50/80 px-5 py-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </div>
            )}

            {images.length === 0 ? (
              <div className="glass flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-2xl px-5 py-8 text-center text-sm text-sand-500 sm:rounded-3xl dark:text-sand-400">
                <span className="text-3xl">🗂️</span>
                <p>目前没有临时图片。</p>
              </div>
            ) : (
              <Image.PreviewGroup>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {images.map((image) => (
                    <figure
                      key={image.fileName}
                      className="glass overflow-hidden rounded-2xl"
                    >
                      <Image
                        src={image.url}
                        alt={image.fileName}
                        className="!h-48 !w-full object-cover"
                        rootClassName="!block"
                        preview={{ mask: "预览" }}
                      />
                      <figcaption className="flex flex-col gap-2 p-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sand-800 tabular-nums dark:text-sand-200">
                            {formatDateTime(image.uploadedAt)}
                          </span>
                          <span className="text-sand-500 dark:text-sand-500">
                            {formatRelativeTime(image.uploadedAt, now)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-sand-500 dark:text-sand-500">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatRemaining(image.expiresAt, now)}
                          </span>
                          <span className="tabular-nums">
                            {formatSize(image.size)}
                          </span>
                        </div>
                        <span
                          className="truncate text-[11px] text-sand-400 dark:text-sand-600"
                          title={image.fileName}
                        >
                          {image.fileName}
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopy(image.url)}
                            className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-clay-200 bg-clay-50/70 text-xs font-medium text-clay-700 transition active:scale-95 hover:bg-clay-100 dark:border-clay-500/40 dark:bg-clay-500/10 dark:text-clay-300 dark:hover:bg-clay-500/20"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            {copied === image.url ? "已复制" : "复制链接"}
                          </button>
                          <a
                            href={image.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-sand-200 bg-white/70 text-xs text-sand-700 transition active:scale-95 hover:bg-sand-100 dark:border-sand-700 dark:bg-sand-900/60 dark:text-sand-300 dark:hover:bg-sand-800"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            新窗口打开
                          </a>
                        </div>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </Image.PreviewGroup>
            )}
          </>
        )}
      </div>
    </div>
  );
}
