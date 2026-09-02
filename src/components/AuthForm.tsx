"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Form, Input } from "antd";

type Mode = "login" | "register";

type Values = {
  username: string;
  password: string;
  confirmPassword?: string;
};

/** 只允许站内相对路径，避免开放重定向 */
function sanitizeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = sanitizeNext(searchParams.get("next"));
  const nextQuery = next === "/" ? "" : `?next=${encodeURIComponent(next)}`;

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isLogin = mode === "login";

  async function onFinish(values: Values) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? `请求失败 (${res.status})`);
        return;
      }
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-aurora flex min-h-screen items-center justify-center px-4 py-10">
      <div className="glass w-full max-w-sm rounded-3xl p-6 sm:p-8">
        <div className="mb-6 flex flex-col gap-2">
          <Link
            href="/"
            className="text-xs text-zinc-500 transition hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-300"
          >
            ← 返回首页
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            <span className="gradient-text">{isLogin ? "登录" : "注册"}</span>
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {isLogin
              ? "登录后即可生成与编辑图片，余额实时可见。"
              : "只需用户名和密码，无需邮箱或手机验证。"}
          </p>
        </div>

        {error && (
          <Alert type="error" showIcon message={error} className="mb-4" />
        )}

        <Form<Values>
          layout="vertical"
          size="large"
          requiredMark={false}
          autoComplete="off"
          onFinish={onFinish}
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, message: "请输入用户名" },
              ...(isLogin
                ? []
                : [
                    {
                      pattern: /^[\w一-龥]{2,20}$/,
                      message: "2-20 位字母、数字、下划线或中文",
                    },
                  ]),
            ]}
          >
            <Input autoComplete="username" placeholder="用户名" />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[
              { required: true, message: "请输入密码" },
              ...(isLogin ? [] : [{ min: 6, message: "密码至少 6 位" }]),
            ]}
          >
            <Input.Password
              autoComplete={isLogin ? "current-password" : "new-password"}
              placeholder="密码"
            />
          </Form.Item>

          {!isLogin && (
            <Form.Item
              name="confirmPassword"
              label="确认密码"
              dependencies={["password"]}
              rules={[
                { required: true, message: "请再次输入密码" },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("password") === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error("两次输入的密码不一致"));
                  },
                }),
              ]}
            >
              <Input.Password autoComplete="new-password" placeholder="再输入一次" />
            </Form.Item>
          )}

          <Button
            type="primary"
            htmlType="submit"
            block
            loading={submitting}
            className="mt-1"
          >
            {isLogin ? "登录" : "注册并登录"}
          </Button>
        </Form>

        <p className="mt-5 text-center text-xs text-zinc-500 dark:text-zinc-400">
          {isLogin ? (
            <>
              还没有账号？
              <Link
                href={`/register${nextQuery}`}
                className="font-medium text-indigo-600 hover:underline dark:text-indigo-300"
              >
                立即注册
              </Link>
            </>
          ) : (
            <>
              已有账号？
              <Link
                href={`/login${nextQuery}`}
                className="font-medium text-indigo-600 hover:underline dark:text-indigo-300"
              >
                去登录
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
