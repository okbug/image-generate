"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  App,
  Button,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Space,
  Table,
  Tabs,
  Tag,
  type TableProps,
} from "antd";
import { ArrowLeft, RefreshCw, ShieldCheck } from "lucide-react";

import { centsToYuan, formatCents, yuanToCents } from "@/lib/money";
import type {
  AdminSettingsResponse,
  AdminUsersResponse,
  SettingsView,
  TransactionRecord,
  TransactionsResponse,
} from "@/types/admin";
import type { SessionUser } from "@/types/auth";

// ---------- 通用 ----------

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? `请求失败 (${res.status})`);
  }
  return json;
}

function formatTime(ts: number | null): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("zh-CN", { hour12: false });
}

const TX_TYPE_LABEL: Record<string, { text: string; color: string }> = {
  generate: { text: "生成", color: "geekblue" },
  edit: { text: "编辑", color: "purple" },
  optimize: { text: "优化提示词", color: "cyan" },
  refund: { text: "退款", color: "gold" },
  topup: { text: "充值", color: "green" },
  adjust: { text: "扣减", color: "volcano" },
  bonus: { text: "赠送", color: "lime" },
};

// ---------- 用户管理 ----------

type BalanceModalState = {
  user: SessionUser;
  direction: "add" | "sub";
} | null;

function UsersTab({ admin }: { admin: SessionUser }) {
  const { message } = App.useApp();
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [balanceModal, setBalanceModal] = useState<BalanceModalState>(null);
  const [passwordUser, setPasswordUser] = useState<SessionUser | null>(null);
  const [balanceForm] = Form.useForm<{ yuan: number; note?: string }>();
  const [passwordForm] = Form.useForm<{ password: string }>();

  const load = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        const res = await request<AdminUsersResponse>(
          `/api/admin/users?q=${encodeURIComponent(q)}`,
        );
        setData(res);
      } catch (err) {
        message.error(err instanceof Error ? err.message : "加载失败");
      } finally {
        setLoading(false);
      }
    },
    [message],
  );

  // 首次进入拉取列表；load 内的 setState 都在 await 之后触发。
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load("");
  }, [load]);

  async function submitBalance() {
    if (!balanceModal) return;
    const values = await balanceForm.validateFields();
    const cents = yuanToCents(values.yuan);
    const amount = balanceModal.direction === "add" ? cents : -cents;
    try {
      await request(`/api/admin/users/${balanceModal.user.id}/balance`, {
        method: "POST",
        body: JSON.stringify({ amount, note: values.note }),
      });
      message.success(
        `${balanceModal.direction === "add" ? "充值" : "扣减"} ${formatCents(cents)} 成功`,
      );
      setBalanceModal(null);
      balanceForm.resetFields();
      void load(query);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "操作失败");
    }
  }

  async function submitPassword() {
    if (!passwordUser) return;
    const values = await passwordForm.validateFields();
    try {
      await request(`/api/admin/users/${passwordUser.id}`, {
        method: "PATCH",
        body: JSON.stringify({ password: values.password }),
      });
      message.success(`已重置「${passwordUser.username}」的密码`);
      setPasswordUser(null);
      passwordForm.resetFields();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "操作失败");
    }
  }

  async function toggleRole(user: SessionUser) {
    const role = user.role === "admin" ? "user" : "admin";
    try {
      await request(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      message.success(
        role === "admin"
          ? `已把「${user.username}」设为管理员`
          : `已取消「${user.username}」的管理员身份`,
      );
      void load(query);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "操作失败");
    }
  }

  const columns: TableProps<SessionUser>["columns"] = [
    { title: "ID", dataIndex: "id", width: 70 },
    {
      title: "用户名",
      dataIndex: "username",
      render: (value: string, row) => (
        <Space size={6}>
          <span className="font-medium">{value}</span>
          {row.id === admin.id && <Tag color="blue">我</Tag>}
        </Space>
      ),
    },
    {
      title: "角色",
      dataIndex: "role",
      width: 100,
      render: (role: SessionUser["role"]) =>
        role === "admin" ? <Tag color="magenta">管理员</Tag> : <Tag>用户</Tag>,
    },
    {
      title: "余额",
      dataIndex: "balance",
      width: 120,
      sorter: (a, b) => a.balance - b.balance,
      render: (cents: number) => (
        <span className="font-medium tabular-nums">{formatCents(cents)}</span>
      ),
    },
    {
      title: "注册时间",
      dataIndex: "createdAt",
      width: 170,
      render: formatTime,
    },
    {
      title: "最近登录",
      dataIndex: "lastLoginAt",
      width: 170,
      render: formatTime,
    },
    {
      title: "操作",
      key: "actions",
      render: (_, row) => (
        <Space size={4} wrap>
          <Button
            size="small"
            type="primary"
            onClick={() => {
              balanceForm.resetFields();
              setBalanceModal({ user: row, direction: "add" });
            }}
          >
            充值
          </Button>
          <Button
            size="small"
            onClick={() => {
              balanceForm.resetFields();
              setBalanceModal({ user: row, direction: "sub" });
            }}
          >
            扣减
          </Button>
          <Button
            size="small"
            onClick={() => {
              passwordForm.resetFields();
              setPasswordUser(row);
            }}
          >
            重置密码
          </Button>
          {row.id !== admin.id && (
            <Popconfirm
              title={
                row.role === "admin"
                  ? `取消「${row.username}」的管理员身份？`
                  : `把「${row.username}」设为管理员？`
              }
              onConfirm={() => toggleRole(row)}
              okText="确定"
              cancelText="取消"
            >
              <Button size="small" danger={row.role === "admin"}>
                {row.role === "admin" ? "取消管理员" : "设为管理员"}
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input.Search
          allowClear
          placeholder="按用户名搜索"
          className="max-w-xs"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onSearch={(v) => void load(v)}
        />
        <Button
          icon={<RefreshCw className="h-3.5 w-3.5" />}
          onClick={() => void load(query)}
          loading={loading}
        >
          刷新
        </Button>
        {data && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            共 {data.total} 个用户 · 余额合计 {formatCents(data.totalBalance)}
          </span>
        )}
      </div>

      <Table<SessionUser>
        rowKey="id"
        size="middle"
        loading={loading}
        columns={columns}
        dataSource={data?.users ?? []}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        scroll={{ x: 900 }}
      />

      <Modal
        title={
          balanceModal
            ? `${balanceModal.direction === "add" ? "充值" : "扣减"} · ${balanceModal.user.username}（当前 ${formatCents(balanceModal.user.balance)}）`
            : ""
        }
        open={balanceModal !== null}
        onCancel={() => setBalanceModal(null)}
        onOk={() => void submitBalance()}
        okText="确认"
        cancelText="取消"
      >
        <Form form={balanceForm} layout="vertical" className="pt-2">
          <Form.Item label="方向">
            <Radio.Group
              value={balanceModal?.direction}
              onChange={(e) =>
                setBalanceModal((s) =>
                  s ? { ...s, direction: e.target.value } : s,
                )
              }
              options={[
                { label: "充值（加余额）", value: "add" },
                { label: "扣减（减余额）", value: "sub" },
              ]}
              optionType="button"
            />
          </Form.Item>
          <Form.Item
            name="yuan"
            label="金额（元）"
            rules={[
              { required: true, message: "请输入金额" },
              {
                validator: (_, v) =>
                  typeof v === "number" && v > 0
                    ? Promise.resolve()
                    : Promise.reject(new Error("金额需大于 0")),
              },
            ]}
          >
            <InputNumber
              min={0.01}
              step={1}
              precision={2}
              prefix="¥"
              className="w-full"
              placeholder="例如 10.00"
            />
          </Form.Item>
          <Form.Item name="note" label="备注（可选）">
            <Input placeholder="例如：微信转账 / 活动赠送" maxLength={100} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={passwordUser ? `重置密码 · ${passwordUser.username}` : ""}
        open={passwordUser !== null}
        onCancel={() => setPasswordUser(null)}
        onOk={() => void submitPassword()}
        okText="重置"
        cancelText="取消"
      >
        <Form form={passwordForm} layout="vertical" className="pt-2">
          <Form.Item
            name="password"
            label="新密码"
            rules={[
              { required: true, message: "请输入新密码" },
              { min: 6, message: "至少 6 位" },
            ]}
          >
            <Input.Password placeholder="至少 6 位" autoComplete="new-password" />
          </Form.Item>
          <p className="text-xs text-zinc-500">重置后该用户所有设备都需要重新登录。</p>
        </Form>
      </Modal>
    </div>
  );
}

// ---------- 系统设置 ----------

type SettingsFormValues = {
  priceGenerate: number;
  priceEdit: number;
  priceOptimize: number;
  registerBonus: number;
  apiBaseUrl: string;
  apiKey?: string;
  clearApiKey?: boolean;
};

function SettingsTab() {
  const { message } = App.useApp();
  const [form] = Form.useForm<SettingsFormValues>();
  const [data, setData] = useState<AdminSettingsResponse | null>(null);
  const [saving, setSaving] = useState(false);

  const applyToForm = useCallback(
    (s: SettingsView) => {
      form.setFieldsValue({
        priceGenerate: centsToYuan(s.priceGenerate),
        priceEdit: centsToYuan(s.priceEdit),
        priceOptimize: centsToYuan(s.priceOptimize),
        registerBonus: centsToYuan(s.registerBonus),
        apiBaseUrl: s.apiBaseUrl,
        apiKey: "",
        clearApiKey: false,
      });
    },
    [form],
  );

  useEffect(() => {
    request<AdminSettingsResponse>("/api/admin/settings")
      .then((res) => {
        setData(res);
        applyToForm(res.settings);
      })
      .catch((err) =>
        message.error(err instanceof Error ? err.message : "加载失败"),
      );
  }, [applyToForm, message]);

  async function onFinish(values: SettingsFormValues) {
    setSaving(true);
    try {
      const res = await request<AdminSettingsResponse>("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          priceGenerate: yuanToCents(values.priceGenerate),
          priceEdit: yuanToCents(values.priceEdit),
          priceOptimize: yuanToCents(values.priceOptimize),
          registerBonus: yuanToCents(values.registerBonus),
          apiBaseUrl: values.apiBaseUrl ?? "",
          apiKey: values.apiKey?.trim() || undefined,
          clearApiKey: Boolean(values.clearApiKey),
        }),
      });
      setData(res);
      applyToForm(res.settings);
      message.success("设置已保存");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  const priceField = (name: keyof SettingsFormValues, label: string, extra?: string) => (
    <Form.Item
      name={name}
      label={label}
      extra={extra}
      rules={[{ required: true, message: "必填" }]}
    >
      <InputNumber min={0} step={0.1} precision={2} prefix="¥" className="w-full" />
    </Form.Item>
  );

  return (
    <Form<SettingsFormValues>
      form={form}
      layout="vertical"
      onFinish={onFinish}
      className="max-w-2xl"
    >
      <h3 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        定价（每次调用扣除，用户使用自己的自定义 API 时不扣费）
      </h3>
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        {priceField("priceGenerate", "生成图片 · 每张")}
        {priceField("priceEdit", "编辑图片 · 每次")}
        {priceField("priceOptimize", "优化提示词 · 每次", "填 0 表示免费")}
        {priceField("registerBonus", "新用户注册赠送", "填 0 表示不赠送")}
      </div>

      <h3 className="mt-4 mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        默认生图后端（OpenAI 兼容接口）
      </h3>
      <Form.Item
        name="apiBaseUrl"
        label="BaseURL"
        extra="不带末尾斜杠，会自动拼接 /v1/images/generations 等路径。留空则回退到环境变量。"
        rules={[
          {
            pattern: /^(https?:\/\/\S+)?$/i,
            message: "需以 http(s):// 开头",
          },
        ]}
      >
        <Input placeholder="https://api.example.com" allowClear />
      </Form.Item>
      <Form.Item
        name="apiKey"
        label="API Key"
        extra={
          data?.settings.apiKeySet
            ? `当前已保存：${data.settings.apiKeyMasked}。留空表示保持不变。`
            : "当前未保存 Key。"
        }
      >
        <Input.Password placeholder="sk-..." autoComplete="off" />
      </Form.Item>
      <Form.Item name="clearApiKey" valuePropName="checked">
        <Checkbox>清空已保存的 Key（回退到环境变量）</Checkbox>
      </Form.Item>

      {data && (
        <div className="mb-4 rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-4 py-3 text-xs text-zinc-600 dark:border-zinc-700/70 dark:bg-zinc-900/40 dark:text-zinc-400">
          <p className="mb-1 font-medium">环境变量兜底（.env.local）</p>
          <p>
            BaseURL：{data.env.apiBaseUrl || "未设置"} · Key：
            {data.env.apiKeySet ? data.env.apiKeyMasked : "未设置"}
          </p>
          <p className="mt-1">
            生效顺序：用户自定义凭证 → 这里保存的设置 → 环境变量。
          </p>
        </div>
      )}

      <Button type="primary" htmlType="submit" loading={saving}>
        保存设置
      </Button>
    </Form>
  );
}

// ---------- 消费流水 ----------

function TransactionsTab() {
  const { message } = App.useApp();
  const [rows, setRows] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        const res = await request<TransactionsResponse>(
          `/api/admin/transactions?q=${encodeURIComponent(q)}&limit=200`,
        );
        setRows(res.transactions);
      } catch (err) {
        message.error(err instanceof Error ? err.message : "加载失败");
      } finally {
        setLoading(false);
      }
    },
    [message],
  );

  // 同上：首次进入拉取流水
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load("");
  }, [load]);

  const columns = useMemo<TableProps<TransactionRecord>["columns"]>(
    () => [
      { title: "ID", dataIndex: "id", width: 80 },
      { title: "用户", dataIndex: "username", width: 140 },
      {
        title: "类型",
        dataIndex: "type",
        width: 110,
        render: (type: string) => {
          const meta = TX_TYPE_LABEL[type] ?? { text: type, color: "default" };
          return <Tag color={meta.color}>{meta.text}</Tag>;
        },
      },
      {
        title: "变动",
        dataIndex: "amount",
        width: 120,
        render: (amount: number) => (
          <span
            className={`font-medium tabular-nums ${
              amount >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {amount >= 0 ? "+" : ""}
            {formatCents(amount)}
          </span>
        ),
      },
      {
        title: "余额",
        dataIndex: "balanceAfter",
        width: 120,
        render: (v: number) => <span className="tabular-nums">{formatCents(v)}</span>,
      },
      { title: "备注", dataIndex: "note", ellipsis: true },
      { title: "操作人", dataIndex: "operator", width: 120, render: (v) => v ?? "-" },
      { title: "时间", dataIndex: "createdAt", width: 170, render: formatTime },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input.Search
          allowClear
          placeholder="按用户名筛选"
          className="max-w-xs"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onSearch={(v) => void load(v)}
        />
        <Button
          icon={<RefreshCw className="h-3.5 w-3.5" />}
          onClick={() => void load(query)}
          loading={loading}
        >
          刷新
        </Button>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">最近 200 条</span>
      </div>
      <Table<TransactionRecord>
        rowKey="id"
        size="middle"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={{ pageSize: 25, showSizeChanger: false }}
        scroll={{ x: 900 }}
      />
    </div>
  );
}

// ---------- 修改自己的密码 ----------

type PasswordFormValues = {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
};

function AccountTab({ admin }: { admin: SessionUser }) {
  const { message } = App.useApp();
  const [form] = Form.useForm<PasswordFormValues>();
  const [submitting, setSubmitting] = useState(false);

  async function onFinish(values: PasswordFormValues) {
    setSubmitting(true);
    try {
      await request("/api/auth/password", {
        method: "POST",
        body: JSON.stringify({
          oldPassword: values.oldPassword,
          newPassword: values.newPassword,
        }),
      });
      form.resetFields();
      message.success("密码已修改，其它设备需要重新登录");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "修改失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form<PasswordFormValues>
      form={form}
      layout="vertical"
      onFinish={onFinish}
      autoComplete="off"
      className="max-w-sm"
    >
      <div className="mb-4 rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-4 py-3 text-xs text-zinc-600 dark:border-zinc-700/70 dark:bg-zinc-900/40 dark:text-zinc-400">
        正在修改管理员「{admin.username}」的登录密码。需要先验证原密码；
        修改成功后当前浏览器会保持登录，其它设备上的会话会全部失效。
      </div>

      <Form.Item
        name="oldPassword"
        label="原密码"
        rules={[{ required: true, message: "请输入原密码" }]}
      >
        <Input.Password placeholder="当前登录密码" autoComplete="current-password" />
      </Form.Item>

      <Form.Item
        name="newPassword"
        label="新密码"
        rules={[
          { required: true, message: "请输入新密码" },
          { min: 6, message: "密码至少 6 位" },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || value !== getFieldValue("oldPassword")) {
                return Promise.resolve();
              }
              return Promise.reject(new Error("新密码不能与原密码相同"));
            },
          }),
        ]}
      >
        <Input.Password placeholder="至少 6 位" autoComplete="new-password" />
      </Form.Item>

      <Form.Item
        name="confirmPassword"
        label="确认新密码"
        dependencies={["newPassword"]}
        rules={[
          { required: true, message: "请再次输入新密码" },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue("newPassword") === value) {
                return Promise.resolve();
              }
              return Promise.reject(new Error("两次输入的新密码不一致"));
            },
          }),
        ]}
      >
        <Input.Password placeholder="再输入一次" autoComplete="new-password" />
      </Form.Item>

      <Button type="primary" htmlType="submit" loading={submitting}>
        修改密码
      </Button>
    </Form>
  );
}

// ---------- 页面 ----------

export function AdminPanel({ admin }: { admin: SessionUser }) {
  return (
    <div className="app-aurora min-h-screen px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs text-zinc-500 transition hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              返回首页
            </Link>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight md:text-3xl">
              <ShieldCheck className="h-6 w-6 text-indigo-500" />
              <span className="gradient-text">管理后台</span>
            </h1>
          </div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            当前管理员：{admin.username}
          </span>
        </header>

        <div className="glass rounded-2xl p-4 sm:rounded-3xl sm:p-6">
          <Tabs
            defaultActiveKey="users"
            items={[
              { key: "users", label: "用户与余额", children: <UsersTab admin={admin} /> },
              { key: "settings", label: "定价与生图 API", children: <SettingsTab /> },
              { key: "transactions", label: "消费流水", children: <TransactionsTab /> },
              { key: "account", label: "修改密码", children: <AccountTab admin={admin} /> },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
