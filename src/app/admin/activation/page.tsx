"use client";

import { useCallback, useEffect, useState } from "react";

import {
  App,
  Button,
  DatePicker,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Switch,
  Table,
  Tabs,
  Tag,
  type TableColumnsType,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { KeyRound, Lock, LogOut, RefreshCw } from "lucide-react";

import {
  type ActivationCodeStats,
  DEFAULT_DAILY_LIMIT,
  type UsageRecord,
  type UsageSummary,
} from "@/lib/activation-shared";
import { IMAGE_MODEL_OPTIONS } from "@/lib/models";

const API_BASE = "/api/admin/activation";
const BEIJING_TIME_FORMAT = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function formatTime(value: string | null): string {
  return value ? BEIJING_TIME_FORMAT.format(new Date(value)) : "-";
}

function maskKey(key: string): string {
  return key.length <= 8 ? key : `${key.slice(0, 4)}…${key.slice(-4)}`;
}

/** 调管理接口，401 时回到登录页，其他错误抛出中文提示。 */
async function adminFetch<T>(
  path: string,
  onUnauthorized: () => void,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (res.status === 401) onUnauthorized();
  if (!res.ok) throw new Error(json.error ?? `请求失败 (${res.status})`);
  return json;
}

function LoginCard({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!password || loading) return;
    setLoading(true);
    setError(null);
    try {
      await adminFetch("/session", () => undefined, {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass mx-auto flex w-full max-w-md flex-col gap-4 rounded-2xl p-6 sm:rounded-3xl sm:p-8">
      <div className="flex items-center gap-3 text-clay-600 dark:text-clay-400">
        <Lock className="h-5 w-5" />
        <span className="font-medium">输入管理密码</span>
      </div>
      <Input.Password
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onPressEnter={() => void handleLogin()}
        placeholder="管理密码"
        size="large"
        autoFocus
      />
      {error && (
        <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
      )}
      <Button
        type="primary"
        size="large"
        loading={loading}
        disabled={!password}
        onClick={() => void handleLogin()}
      >
        登录
      </Button>
    </div>
  );
}

function CreateCodeModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: {
    key?: string;
    user: string;
    dailyLimit: number;
  }) => Promise<void>;
}) {
  const [user, setUser] = useState("");
  const [key, setKey] = useState("");
  const [dailyLimit, setDailyLimit] = useState<number | null>(
    DEFAULT_DAILY_LIMIT,
  );
  const [saving, setSaving] = useState(false);

  async function handleOk() {
    setSaving(true);
    try {
      await onCreate({
        key: key.trim() || undefined,
        user: user.trim(),
        dailyLimit: dailyLimit ?? DEFAULT_DAILY_LIMIT,
      });
      setUser("");
      setKey("");
      setDailyLimit(DEFAULT_DAILY_LIMIT);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="新增激活码"
      open={open}
      onCancel={onClose}
      onOk={() => void handleOk()}
      okText="创建"
      cancelText="取消"
      confirmLoading={saving}
      okButtonProps={{ disabled: !user.trim() }}
    >
      <div className="flex flex-col gap-3 pt-1">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">使用人</span>
          <Input value={user} onChange={(e) => setUser(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">激活码</span>
          <Input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="留空自动生成"
            autoComplete="off"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">每日限额（张）</span>
          <InputNumber
            value={dailyLimit}
            onChange={setDailyLimit}
            min={0}
            precision={0}
            className="!w-full"
          />
        </label>
      </div>
    </Modal>
  );
}

function CodesPanel({ onUnauthorized }: { onUnauthorized: () => void }) {
  const { message } = App.useApp();
  const [codes, setCodes] = useState<ActivationCodeStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = await adminFetch<{ codes: ActivationCodeStats[] }>(
        "/codes",
        onUnauthorized,
      );
      setCodes(json.codes);
    } catch (err) {
      void message.error(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [message, onUnauthorized]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function mutate(method: string, body: object, success?: string) {
    try {
      await adminFetch("/codes", onUnauthorized, {
        method,
        body: JSON.stringify(body),
      });
      if (success) void message.success(success);
      await load();
      return true;
    } catch (err) {
      void message.error(err instanceof Error ? err.message : "操作失败");
      return false;
    }
  }

  function copyKey(key: string) {
    navigator.clipboard
      .writeText(key)
      .then(() => void message.success("已复制激活码"))
      .catch(() => void message.error("复制失败，请手动复制"));
  }

  const columns: TableColumnsType<ActivationCodeStats> = [
    {
      title: "使用人",
      dataIndex: "user",
      render: (user: string, code) => (
        <Input
          key={user}
          defaultValue={user}
          variant="borderless"
          className="!px-0"
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next && next !== user) {
              void mutate("PATCH", { key: code.key, user: next }, "已更新");
            }
          }}
        />
      ),
    },
    {
      title: "激活码",
      dataIndex: "key",
      render: (key: string) => (
        <button
          type="button"
          title="点击复制"
          onClick={() => copyKey(key)}
          className="font-mono text-xs hover:text-clay-600"
        >
          {maskKey(key)}
        </button>
      ),
    },
    {
      title: "今日 / 限额",
      key: "limit",
      width: 150,
      render: (_, code) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          {code.usedToday} /
          <InputNumber
            key={code.dailyLimit}
            defaultValue={code.dailyLimit}
            min={0}
            precision={0}
            size="small"
            className="!w-20"
            onBlur={(e) => {
              const next = Number(e.target.value);
              if (Number.isInteger(next) && next !== code.dailyLimit) {
                void mutate(
                  "PATCH",
                  { key: code.key, dailyLimit: next },
                  "限额已更新",
                );
              }
            }}
          />
        </span>
      ),
    },
    { title: "总张数", dataIndex: "totalImages", width: 80 },
    { title: "总调用", dataIndex: "totalCalls", width: 80 },
    {
      title: "最后使用",
      dataIndex: "lastUsedAt",
      width: 180,
      render: formatTime,
    },
    {
      title: "启用",
      key: "enabled",
      width: 70,
      render: (_, code) => (
        <Switch
          size="small"
          checked={!code.disabled}
          onChange={(checked) =>
            void mutate("PATCH", { key: code.key, disabled: !checked })
          }
        />
      ),
    },
    {
      title: "",
      key: "delete",
      width: 70,
      render: (_, code) => (
        <Popconfirm
          title="删除这个激活码？"
          description="使用记录会保留。"
          okText="删除"
          cancelText="取消"
          onConfirm={() => void mutate("DELETE", { key: code.key }, "已删除")}
        >
          <Button size="small" danger type="text">
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-sand-500 dark:text-sand-400">
          今日用量按北京时间计算，点击激活码可复制完整内容。
        </p>
        <div className="flex shrink-0 gap-2">
          <Button
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            onClick={() => void load()}
          >
            刷新
          </Button>
          <Button type="primary" onClick={() => setCreateOpen(true)}>
            新增激活码
          </Button>
        </div>
      </div>
      <Table
        rowKey="key"
        size="small"
        loading={loading}
        columns={columns}
        dataSource={codes}
        pagination={false}
        scroll={{ x: 860 }}
        locale={{ emptyText: "还没有激活码" }}
      />
      <CreateCodeModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={async (input) => {
          if (await mutate("POST", input, "已创建")) setCreateOpen(false);
        }}
      />
    </div>
  );
}

function UsagePanel({ onUnauthorized }: { onUnauthorized: () => void }) {
  const { message } = App.useApp();
  const [range, setRange] = useState<[Dayjs, Dayjs]>(() => [
    dayjs().subtract(6, "day"),
    dayjs(),
  ]);
  const [user, setUser] = useState("");
  const [model, setModel] = useState<string>();
  const [quality, setQuality] = useState<string>();
  const [result, setResult] = useState<string>();
  const [records, setRecords] = useState<UsageRecord[]>([]);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      from: range[0].format("YYYY-MM-DD"),
      to: range[1].format("YYYY-MM-DD"),
    });
    if (user.trim()) params.set("user", user.trim());
    if (model) params.set("model", model);
    if (quality) params.set("quality", quality);
    if (result) params.set("result", result);

    setLoading(true);
    try {
      const json = await adminFetch<{
        records: UsageRecord[];
        summary: UsageSummary;
        truncated: boolean;
      }>(`/usage?${params.toString()}`, onUnauthorized);
      setRecords(json.records);
      setSummary(json.summary);
      setTruncated(json.truncated);
    } catch (err) {
      void message.error(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [message, model, onUnauthorized, quality, range, result, user]);

  useEffect(() => {
    void Promise.resolve().then(load);
    // 使用人靠点「查询」或回车触发，其余筛选项改动后立即查询
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, model, quality, result]);

  const columns: TableColumnsType<UsageRecord> = [
    { title: "时间", dataIndex: "at", width: 170, render: formatTime },
    { title: "使用人", dataIndex: "user", width: 100 },
    {
      title: "类型",
      dataIndex: "mode",
      width: 70,
      render: (mode: UsageRecord["mode"]) =>
        mode === "edit" ? "改图" : "文生图",
    },
    { title: "模型", dataIndex: "model", width: 190 },
    {
      title: "画质",
      key: "quality",
      width: 120,
      render: (_, record) => `${record.quality} → ${record.upstreamQuality}`,
    },
    { title: "尺寸", dataIndex: "size", width: 100 },
    {
      title: "张数",
      key: "images",
      width: 70,
      render: (_, record) => `${record.images}/${record.n}`,
    },
    { title: "参考图", dataIndex: "referenceCount", width: 70 },
    {
      title: "结果",
      key: "result",
      width: 220,
      render: (_, record) =>
        record.ok ? (
          <Tag color="success">成功</Tag>
        ) : (
          <span title={record.error}>
            <Tag color="error">失败 {record.status}</Tag>
            <span className="text-xs text-sand-500">
              {record.error?.slice(0, 40)}
            </span>
          </span>
        ),
    },
    {
      title: "耗时",
      dataIndex: "ms",
      width: 80,
      render: (ms: number) => `${(ms / 1000).toFixed(1)}s`,
    },
    {
      title: "Tokens",
      dataIndex: "totalTokens",
      width: 90,
      render: (tokens?: number) => tokens ?? "-",
    },
    { title: "IP", dataIndex: "ip", width: 130 },
    {
      title: "激活码",
      dataIndex: "key",
      width: 110,
      render: (key: string) => (
        <span className="font-mono text-xs">{maskKey(key)}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <DatePicker.RangePicker
          value={range}
          allowClear={false}
          onChange={(dates) => {
            if (dates?.[0] && dates[1]) setRange([dates[0], dates[1]]);
          }}
        />
        <Input
          value={user}
          onChange={(e) => setUser(e.target.value)}
          onPressEnter={() => void load()}
          placeholder="使用人"
          className="!w-32"
        />
        <Select
          value={model}
          onChange={setModel}
          allowClear
          placeholder="模型"
          className="w-52"
          options={IMAGE_MODEL_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
        />
        <Select
          value={quality}
          onChange={setQuality}
          allowClear
          placeholder="画质"
          className="w-28"
          options={[
            { value: "standard", label: "标准" },
            { value: "hd", label: "高清" },
          ]}
        />
        <Select
          value={result}
          onChange={setResult}
          allowClear
          placeholder="结果"
          className="w-24"
          options={[
            { value: "ok", label: "成功" },
            { value: "fail", label: "失败" },
          ]}
        />
        <Button onClick={() => void load()}>查询</Button>
      </div>

      {summary && (
        <p className="text-xs text-sand-600 dark:text-sand-400">
          共 {summary.calls} 次调用，成功 {summary.successCalls} 次，出图{" "}
          {summary.images} 张，合计 {summary.totalTokens} tokens
          {truncated ? "（列表只显示最近 500 条，汇总按全部记录计算）" : ""}
        </p>
      )}

      <Table
        rowKey={(record) => `${record.at}-${record.key}-${record.ms}`}
        size="small"
        loading={loading}
        columns={columns}
        dataSource={records}
        pagination={{ pageSize: 50, showSizeChanger: false }}
        scroll={{ x: 1500 }}
        locale={{ emptyText: "这段时间没有使用记录" }}
      />
    </div>
  );
}

export default function ActivationAdminPage() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  const handleUnauthorized = useCallback(() => setLoggedIn(false), []);

  useEffect(() => {
    let cancelled = false;
    void adminFetch<{ loggedIn: boolean }>("/session", () => undefined)
      .then((json) => {
        if (!cancelled) setLoggedIn(json.loggedIn);
      })
      .catch(() => {
        if (!cancelled) setLoggedIn(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    await fetch(`${API_BASE}/session`, { method: "DELETE" }).catch(
      () => undefined,
    );
    setLoggedIn(false);
  }

  return (
    <div className="min-h-screen px-4 py-6 md:px-8 md:py-14">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 md:gap-10">
        <header className="flex items-center gap-3">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-clay-600 text-white shadow-sm dark:bg-clay-500">
            <KeyRound className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              <span className="brand-title">激活码管理</span>
            </h1>
            <p className="text-sm text-sand-600 dark:text-sand-400">
              管理「使用官方生图」的激活码，查看使用记录
            </p>
          </div>
          {loggedIn && (
            <Button
              icon={<LogOut className="h-3.5 w-3.5" />}
              onClick={() => void handleLogout()}
            >
              退出
            </Button>
          )}
        </header>

        {loggedIn === false && <LoginCard onLogin={() => setLoggedIn(true)} />}

        {loggedIn && (
          <div className="glass rounded-2xl p-4 sm:rounded-3xl sm:p-6">
            <Tabs
              items={[
                {
                  key: "codes",
                  label: "激活码",
                  children: <CodesPanel onUnauthorized={handleUnauthorized} />,
                },
                {
                  key: "usage",
                  label: "使用记录",
                  children: <UsagePanel onUnauthorized={handleUnauthorized} />,
                },
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );
}
