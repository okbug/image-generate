"use client";

import { useState } from "react";
import { Button, Drawer, Input, Modal, Switch } from "antd";

import { DEFAULT_OPTIMIZE_MODEL } from "@/lib/models";
import type { CustomApiSettings } from "@/lib/use-custom-api";
import { useMediaQuery } from "@/lib/use-media-query";

type Props = {
  open: boolean;
  initial: CustomApiSettings;
  onClose: () => void;
  onSave: (next: CustomApiSettings) => void;
};

function FormFields({
  enabled,
  setEnabled,
  baseUrl,
  setBaseUrl,
  apiKey,
  setApiKey,
  optimizeModel,
  setOptimizeModel,
}: {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  baseUrl: string;
  setBaseUrl: (v: string) => void;
  apiKey: string;
  setApiKey: (v: string) => void;
  optimizeModel: string;
  setOptimizeModel: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4 pt-1">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:border-amber-700/40 dark:bg-amber-500/10 dark:text-amber-200">
        <p>
          <span className="font-semibold">🔒 隐私说明：</span>
          本网站不会保存你的 BaseURL 与 API Key。它们只会保存在你浏览器的{" "}
          <code className="rounded bg-amber-100/80 px-1 py-0.5 text-[11px] dark:bg-amber-500/20">
            localStorage
          </code>
          ，每次请求时通过请求头临时转发到本站后端，再由后端调用你指定的上游 API，请求结束即丢弃。
        </p>
        <p className="mt-1.5 text-amber-700 dark:text-amber-300">
          清除浏览器数据 / 退出隐私窗口后这些设置会消失，请妥善保管你的 Key。
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-sm font-medium">启用自定义 API</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            关闭则使用网站默认凭证（如有）。
          </span>
        </div>
        <Switch checked={enabled} onChange={setEnabled} />
      </div>

      <div
        className={`flex flex-col gap-3 transition ${
          enabled ? "opacity-100" : "pointer-events-none opacity-50"
        }`}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">BaseURL</span>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="例如 https://your-api-host.com"
            size="large"
            disabled={!enabled}
          />
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
            填你自己的 OpenAI 兼容服务地址，不要带末尾斜杠，路径会自动拼接 /v1/...
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">API Key</span>
          <Input.Password
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            size="large"
            disabled={!enabled}
            autoComplete="off"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 border-t border-zinc-200/80 pt-4 dark:border-zinc-800">
        <span className="text-sm font-medium">优化提示词模型</span>
        <Input
          value={optimizeModel}
          onChange={(e) => setOptimizeModel(e.target.value)}
          placeholder={DEFAULT_OPTIMIZE_MODEL}
          size="large"
          autoComplete="off"
        />
        <span className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          点「✨ 优化提示词」时调用的对话模型，留空即用默认的{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-[11px] dark:bg-zinc-800">
            {DEFAULT_OPTIMIZE_MODEL}
          </code>
          。这一项和上面的开关无关，用网站默认凭证时也生效（前提是上游支持该模型）。
        </span>
      </label>
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
  const [enabled, setEnabled] = useState(initial.enabled);
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [optimizeModel, setOptimizeModel] = useState(initial.optimizeModel);

  const canSave =
    !enabled || (baseUrl.trim().length > 0 && apiKey.trim().length > 0);

  function handleOk() {
    onSave({
      enabled,
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      optimizeModel: optimizeModel.trim(),
    });
    onClose();
  }

  const fields = (
    <FormFields
      enabled={enabled}
      setEnabled={setEnabled}
      baseUrl={baseUrl}
      setBaseUrl={setBaseUrl}
      apiKey={apiKey}
      setApiKey={setApiKey}
      optimizeModel={optimizeModel}
      setOptimizeModel={setOptimizeModel}
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
