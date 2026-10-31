"use client";

import { useState } from "react";

import { App } from "antd";
import { ArrowRight, Check, KeyRound, Lock } from "lucide-react";
import { useRouter } from "next/navigation";

import { useCustomApi } from "@/lib/use-custom-api";

type DemoCredentials = { baseUrl: string; apiKey: string };

/** Key 只露头尾，确认弹窗里展示用。 */
function maskKey(key: string): string {
  if (key.length <= 10) return "•".repeat(key.length);
  return `${key.slice(0, 6)}••••••${key.slice(-4)}`;
}

/**
 * /demo：先输访问密码（服务端校验，解锁状态只在内存里，刷新就要重输），
 * 通过后拿到演示用的 BaseURL + Key，一键写进本地设置并回到首页。
 */
export default function DemoPage() {
  const [demo, setDemo] = useState<DemoCredentials | null>(null);

  return (
    <div className="app-aurora min-h-screen px-4 py-6 md:px-8 md:py-14">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 md:gap-10">
        <header className="flex flex-col gap-2.5 md:gap-3">
          <h1 className="brand-title text-3xl md:text-5xl">AI 图片工坊</h1>
          <p className="text-sm leading-relaxed text-sand-600 dark:text-sand-400 md:text-base">
            当前项目可以一键新增配置进入。
          </p>
        </header>

        {demo ? <ApplyCard demo={demo} /> : <UnlockCard onUnlock={setDemo} />}
      </div>
    </div>
  );
}

function UnlockCard({
  onUnlock,
}: {
  onUnlock: (demo: DemoCredentials) => void;
}) {
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim() || checking) return;
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/demo/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = (await res.json()) as Partial<DemoCredentials> & {
        error?: string;
      };
      if (!res.ok || !json.baseUrl || !json.apiKey) {
        setError(json.error ?? `验证失败 (${res.status})`);
        return;
      }
      onUnlock({ baseUrl: json.baseUrl, apiKey: json.apiKey });
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setChecking(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="glass flex flex-col gap-4 rounded-2xl p-5 sm:rounded-3xl sm:p-8"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-sand-800 dark:text-sand-200">
        <Lock className="h-4 w-4 text-clay-600 dark:text-clay-400" />
        请输入访问密码
      </div>
      <p className="-mt-2 text-xs leading-relaxed text-sand-500 dark:text-sand-400">
        密码为
        <span className="font-medium text-sand-700 dark:text-sand-300">
          今天的北京时间日期
        </span>
        ，格式 YYYYMMDD，共 8 位纯数字（月、日不足两位补 0）。例如 2026 年 1 月
        5 日的密码是{" "}
        <code className="rounded bg-sand-100 px-1 py-0.5 font-mono text-sand-700 dark:bg-sand-800 dark:text-sand-300">
          20260105
        </code>
        。密码每天北京时间 0 点更新，每次进入本页都需要重新输入。
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="8 位数字，如 20260105"
          maxLength={8}
          className="h-12 w-full rounded-xl border border-sand-200 bg-white px-4 text-sm text-sand-900 outline-none transition placeholder:text-sand-400 focus:border-clay-400 focus:ring-4 focus:ring-clay-400/10 dark:border-sand-700 dark:bg-sand-900 dark:text-sand-100 sm:h-11"
        />
        <button
          type="submit"
          disabled={!password.trim() || checking}
          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-clay-600 px-6 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] hover:bg-clay-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-clay-500 dark:hover:bg-clay-400 sm:h-11"
        >
          {checking ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          进入
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-300">{error}</p>
      )}
    </form>
  );
}

function ApplyCard({ demo }: { demo: DemoCredentials }) {
  const router = useRouter();
  const { modal, message } = App.useApp();
  const { settings, save, active } = useCustomApi();

  function handleApply() {
    modal.confirm({
      title: "一键填入演示配置？",
      icon: <KeyRound className="mr-2 h-5 w-5 shrink-0 text-clay-600" />,
      content: (
        <div className="flex flex-col gap-2 text-sm text-sand-600 dark:text-sand-300">
          <p>将把以下配置保存到当前浏览器：</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-sand-100 px-3 py-2 font-mono text-xs dark:bg-sand-900">
            <dt className="text-sand-500">BaseURL</dt>
            <dd className="break-all text-sand-900 dark:text-sand-100">
              {demo.baseUrl}
            </dd>
            <dt className="text-sand-500">API Key</dt>
            <dd className="break-all text-sand-900 dark:text-sand-100">
              {maskKey(demo.apiKey)}
            </dd>
          </dl>
          {active && (
            <p className="text-clay-700 dark:text-clay-300">
              你已经配置过 {settings.baseUrl}，确认后会被覆盖。
            </p>
          )}
        </div>
      ),
      okText: "确认填入",
      cancelText: "取消",
      onOk: () => {
        // 优化提示词模型和思考强度是用户自己的偏好，保留原值
        save({
          enabled: true,
          baseUrl: demo.baseUrl,
          apiKey: demo.apiKey,
          optimizeModel: settings.optimizeModel,
          reasoningEffort: settings.reasoningEffort,
        });
        void message.success("配置已填入，正在进入工坊");
        router.push("/");
      },
    });
  }

  return (
    <>
      <section className="glass flex flex-col gap-5 rounded-2xl p-5 sm:rounded-3xl sm:p-8">
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-sand-900 dark:text-sand-100">
            一键配置 API
          </h2>
          <p className="text-sm leading-relaxed text-sand-600 dark:text-sand-400">
            点击下方按钮，会把演示用的 BaseURL 和 API Key
            填入本浏览器的设置中，之后即可直接生成和编辑图片。配置只保存在你的浏览器里，随时可以在首页右上角的设置里修改或清空。
          </p>
        </div>

        {active && (
          <p className="inline-flex items-center gap-1.5 text-xs text-sand-500 dark:text-sand-400">
            <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            当前浏览器已配置：{settings.baseUrl}
          </p>
        )}

        <div className="flex flex-col gap-3 border-t border-sand-200/70 pt-5 dark:border-sand-700/70 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-sand-500 dark:text-sand-500">
            填入前会再确认一次。
          </span>
          <button
            type="button"
            onClick={handleApply}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-clay-600 px-6 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] hover:bg-clay-700 dark:bg-clay-500 dark:hover:bg-clay-400 sm:h-11 sm:w-auto"
          >
            <KeyRound className="h-4 w-4" />
            一键填入配置
          </button>
        </div>
      </section>

      <button
        type="button"
        onClick={() => router.push("/")}
        className="inline-flex items-center gap-1.5 self-start text-sm text-sand-600 transition hover:text-clay-700 dark:text-sand-400 dark:hover:text-clay-300"
      >
        直接进入工坊
        <ArrowRight className="h-4 w-4" />
      </button>
    </>
  );
}
