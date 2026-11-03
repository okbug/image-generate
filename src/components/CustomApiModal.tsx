"use client";

import { useEffect, useState } from "react";
import { Button, Drawer, Input, Modal, Segmented } from "antd";

import type { ActivationStatus } from "@/lib/activation-shared";
import {
  DEFAULT_OPTIMIZE_MODEL,
  DEFAULT_REASONING_EFFORT,
  REASONING_EFFORT_OPTIONS,
  type ReasoningEffort,
} from "@/lib/models";
import type { CustomApiSettings } from "@/lib/use-custom-api";
import { useMediaQuery } from "@/lib/use-media-query";

type Props = {
  open: boolean;
  initial: CustomApiSettings;
  onClose: () => void;
  onSave: (next: CustomApiSettings) => void;
};

async function verifyActivationCode(
  code: string,
): Promise<ActivationStatus | { error: string }> {
  try {
    const res = await fetch("/api/activation/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    return (await res.json()) as ActivationStatus | { error: string };
  } catch {
    return { error: "网络错误，请重试" };
  }
}

/** 「使用官方生图」：校验激活码后记在表单里，点保存才生效。 */
function OfficialImageSection({
  code,
  setCode,
}: {
  code: string;
  setCode: (v: string) => void;
}) {
  const [inputOpen, setInputOpen] = useState(false);
  const [input, setInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [status, setStatus] = useState<ActivationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 打开设置时查一次已保存激活码的状态和今日额度
  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    void verifyActivationCode(code).then((result) => {
      if (cancelled) return;
      if ("error" in result) setError(result.error);
      else setStatus(result);
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  async function handleActivate() {
    const value = input.trim();
    if (!value || verifying) return;
    setVerifying(true);
    setError(null);
    const result = await verifyActivationCode(value);
    setVerifying(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setStatus(result);
    setCode(value);
    setInput("");
    setInputOpen(false);
  }

  function handleTurnOff() {
    setCode("");
    setStatus(null);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-2 border-t border-sand-200/80 pt-4 dark:border-sand-800">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">使用官方生图</span>
        {code ? (
          <Button size="small" onClick={handleTurnOff}>
            关闭
          </Button>
        ) : (
          !inputOpen && (
            <Button size="small" onClick={() => setInputOpen(true)}>
              使用官方生图
            </Button>
          )
        )}
      </div>

      {inputOpen && !code && (
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={() => void handleActivate()}
            placeholder="输入激活码"
            autoComplete="off"
            autoFocus
          />
          <Button
            type="primary"
            loading={verifying}
            disabled={!input.trim()}
            onClick={() => void handleActivate()}
          >
            激活
          </Button>
        </div>
      )}

      {code && status && (
        <p className="text-xs text-clay-700 dark:text-clay-300">
          已激活（{status.user}），今日已用 {status.usedToday}/
          {status.dailyLimit} 张，北京时间 0 点重置。点「保存」后生效。
        </p>
      )}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-300">{error}</p>
      )}

      <p className="text-[11px] leading-relaxed text-sand-500 dark:text-sand-400">
        开启后生图和改图由本站调用 OpenAI 官方接口，仍需填写上面的 BaseURL 和
        Key，优化提示词继续使用它们。本站会记录每次调用的使用人、模型、画质、尺寸、张数和
        IP，不记录提示词内容。
      </p>
    </div>
  );
}

function FormFields({
  baseUrl,
  setBaseUrl,
  apiKey,
  setApiKey,
  optimizeModel,
  setOptimizeModel,
  reasoningEffort,
  setReasoningEffort,
  activationCode,
  setActivationCode,
}: {
  baseUrl: string;
  setBaseUrl: (v: string) => void;
  apiKey: string;
  setApiKey: (v: string) => void;
  optimizeModel: string;
  setOptimizeModel: (v: string) => void;
  reasoningEffort: ReasoningEffort;
  setReasoningEffort: (v: ReasoningEffort) => void;
  activationCode: string;
  setActivationCode: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4 pt-1">
      <div className="rounded-lg border border-clay-200 bg-clay-50 px-3 py-2 text-xs leading-relaxed text-clay-800 dark:border-clay-700/40 dark:bg-clay-500/10 dark:text-clay-200">
        <p>
          <span className="font-semibold">🔒 隐私说明：</span>
          本网站不会保存你的 BaseURL 与 API Key。它们只会保存在你浏览器的{" "}
          <code className="rounded bg-clay-100/80 px-1 py-0.5 text-[11px] dark:bg-clay-500/20">
            localStorage
          </code>
          ，每次请求时通过请求头临时转发到本站后端，再由后端调用你指定的上游
          API，请求结束即丢弃。
        </p>
        <p className="mt-1.5 text-clay-700 dark:text-clay-300">
          清除浏览器数据 / 退出隐私窗口后这些设置会消失，请妥善保管你的 Key。
        </p>
      </div>

      <p className="text-xs leading-relaxed text-sand-500 dark:text-sand-400">
        本站不提供默认额度，生图和优化提示词都需要填写你自己的 API 地址和
        Key（两项都必填）。
      </p>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">BaseURL</span>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="例如 https://your-api-host.com"
            size="large"
          />
          <span className="text-[11px] text-sand-500 dark:text-sand-400">
            填你自己的 OpenAI 兼容服务地址，不要带末尾斜杠，路径会自动拼接
            /v1/...
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">API Key</span>
          <Input.Password
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            size="large"
            autoComplete="off"
          />
        </label>
      </div>

      <OfficialImageSection code={activationCode} setCode={setActivationCode} />

      <label className="flex flex-col gap-1.5 border-t border-sand-200/80 pt-4 dark:border-sand-800">
        <span className="text-sm font-medium">优化提示词模型</span>
        <Input
          value={optimizeModel}
          onChange={(e) => setOptimizeModel(e.target.value)}
          placeholder={DEFAULT_OPTIMIZE_MODEL}
          size="large"
          autoComplete="off"
        />
        <span className="text-[11px] leading-relaxed text-sand-500 dark:text-sand-400">
          点「✨ 优化提示词」时调用的对话模型，留空即用默认的{" "}
          <code className="rounded bg-sand-100 px-1 py-0.5 text-[11px] dark:bg-sand-800">
            {DEFAULT_OPTIMIZE_MODEL}
          </code>
          （前提是你的上游支持该模型）。
        </span>
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">思考强度</span>
        <Segmented<ReasoningEffort>
          block
          value={reasoningEffort}
          onChange={setReasoningEffort}
          options={REASONING_EFFORT_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
        />
        <span className="text-[11px] leading-relaxed text-sand-500 dark:text-sand-400">
          优化提示词时模型的思考程度（上游参数{" "}
          <code className="rounded bg-sand-100 px-1 py-0.5 text-[11px] dark:bg-sand-800">
            reasoning_effort
          </code>
          ），越高越细致但越慢，默认 {DEFAULT_REASONING_EFFORT}。
        </span>
      </div>
    </div>
  );
}

function CustomApiForm({
  initial,
  onClose,
  onSave,
}: {
  initial: CustomApiSettings;
  onClose: () => void;
  onSave: (next: CustomApiSettings) => void;
}) {
  const isMobile = useMediaQuery("(max-width: 640px)");
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [optimizeModel, setOptimizeModel] = useState(initial.optimizeModel);
  const [reasoningEffort, setReasoningEffort] = useState(
    initial.reasoningEffort,
  );
  const [activationCode, setActivationCode] = useState(initial.activationCode);

  const canSave = baseUrl.trim().length > 0 && apiKey.trim().length > 0;

  function handleOk() {
    onSave({
      enabled: true,
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      optimizeModel: optimizeModel.trim(),
      reasoningEffort,
      activationCode,
    });
    onClose();
  }

  const fields = (
    <FormFields
      baseUrl={baseUrl}
      setBaseUrl={setBaseUrl}
      apiKey={apiKey}
      setApiKey={setApiKey}
      optimizeModel={optimizeModel}
      setOptimizeModel={setOptimizeModel}
      reasoningEffort={reasoningEffort}
      setReasoningEffort={setReasoningEffort}
      activationCode={activationCode}
      setActivationCode={setActivationCode}
    />
  );

  if (isMobile) {
    return (
      <Drawer
        title="API 与模型设置"
        open
        placement="bottom"
        height="min(640px, 88vh)"
        onClose={onClose}
        styles={{
          body: { paddingBottom: 16, overflowY: "auto" },
        }}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" disabled={!canSave} onClick={handleOk}>
              保存
            </Button>
          </div>
        }
      >
        {fields}
      </Drawer>
    );
  }

  return (
    <Modal
      title="API 与模型设置"
      open
      centered
      width={520}
      onOk={handleOk}
      onCancel={onClose}
      okText="保存"
      cancelText="取消"
      okButtonProps={{ disabled: !canSave }}
    >
      {fields}
    </Modal>
  );
}

export function CustomApiModal({ open, initial, onClose, onSave }: Props) {
  if (!open) return null;
  return <CustomApiForm initial={initial} onClose={onClose} onSave={onSave} />;
}
