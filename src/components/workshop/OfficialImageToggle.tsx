"use client";

import { useState } from "react";

import { App, Button } from "antd";

import { verifyActivationCode } from "@/lib/use-custom-api";

/** 关闭不需要请求后端，也停留片刻，让用户看到按钮有响应。 */
const MIN_LOADING_MS = 300;

/** 首页的官方生图开关：开启时重新校验激活码，失败就保持关闭。 */
export function OfficialImageToggle({
  code,
  enabled,
  disabled,
  onChange,
}: {
  code: string;
  enabled: boolean;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const { message } = App.useApp();
  const [toggling, setToggling] = useState(false);

  async function handleToggle() {
    const next = !enabled;
    setToggling(true);
    const [result] = await Promise.all([
      next ? verifyActivationCode(code) : null,
      new Promise((resolve) => setTimeout(resolve, MIN_LOADING_MS)),
    ]);
    setToggling(false);

    if (result && "error" in result) {
      void message.error(result.error);
      return;
    }
    onChange(next);
    void message.success(next ? "官方生图已开启" : "官方生图已关闭");
  }

  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <p
        className={
          enabled
            ? "text-clay-700 dark:text-clay-300"
            : "text-sand-500 dark:text-sand-400"
        }
      >
        {enabled
          ? "官方生图已开启：生图和改图走官方接口，优化提示词仍用你自己的 API。"
          : "官方生图已关闭：生图和改图使用你自己的 API。"}
      </p>
      <Button
        size="small"
        className="shrink-0"
        type={enabled ? "default" : "primary"}
        loading={toggling}
        disabled={disabled}
        onClick={() => void handleToggle()}
      >
        {enabled ? "关闭" : "开启"}
      </Button>
    </div>
  );
}
