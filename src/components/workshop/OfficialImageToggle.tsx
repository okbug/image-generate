"use client";

import { useState } from "react";

import { App, Button } from "antd";

import type { ActivationStatus } from "@/lib/activation-shared";
import { verifyActivationCode } from "@/lib/use-custom-api";
import { isQuotaExceeded } from "@/lib/use-official-quota";

/** 关闭不需要请求后端，也停留片刻，让用户看到按钮有响应。 */
const MIN_LOADING_MS = 300;

/** 首页的官方生图开关和今日额度：开启时重新校验激活码，失败就保持关闭。 */
export function OfficialImageToggle({
  code,
  enabled,
  status,
  disabled,
  onChange,
}: {
  code: string;
  enabled: boolean;
  status: ActivationStatus | null;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const { message } = App.useApp();
  const [toggling, setToggling] = useState(false);
  const exceeded = isQuotaExceeded(status);

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

  function renderText() {
    if (!enabled) return "官方生图已关闭：生图和改图使用你自己的 API。";
    if (exceeded && status) {
      return `今日官方额度已用完（${status.usedToday}/${status.dailyLimit} 张），北京时间 0 点重置。建议切换到普通模式，用你自己的 API 继续出图。`;
    }
    const quota = status
      ? `今日已用 ${status.usedToday}/${status.dailyLimit} 张。`
      : "";
    return `官方生图已开启：生图和改图走官方接口，优化提示词仍用你自己的 API。${quota}`;
  }

  function buttonLabel() {
    if (!enabled) return "开启";
    return exceeded ? "切换到普通模式" : "关闭";
  }

  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <p
        className={
          !enabled
            ? "text-sand-500 dark:text-sand-400"
            : exceeded
              ? "text-red-600 dark:text-red-300"
              : "text-clay-700 dark:text-clay-300"
        }
      >
        {renderText()}
      </p>
      <Button
        size="small"
        className="shrink-0"
        type={enabled && !exceeded ? "default" : "primary"}
        loading={toggling}
        disabled={disabled}
        onClick={() => void handleToggle()}
      >
        {buttonLabel()}
      </Button>
    </div>
  );
}
