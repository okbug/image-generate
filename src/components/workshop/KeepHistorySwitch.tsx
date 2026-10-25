"use client";

import { Switch } from "antd";

/** 生图按钮上方的「在本地保留生成的图片」开关，决定出图结果要不要记进「最近生成」。 */
export function KeepHistorySwitch({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-3 rounded-xl border border-sand-200 bg-sand-50/80 p-3 dark:border-sand-700 dark:bg-sand-900/40">
      <span className="flex flex-col gap-1">
        <span className="text-sm font-medium text-sand-800 dark:text-sand-200">
          在本地保留生成的图片
        </span>
        <span className="text-xs leading-relaxed text-sand-500 dark:text-sand-400">
          {enabled
            ? "已开启：生成的图片会自动保存到图床，并记录在当前浏览器的「最近生成」中，方便随时找回。"
            : "已关闭：新生成的图片不再记录到本地（图片仍会保存到图床，请在生成后及时下载）。"}
          你可以在页面底部的「最近生成」中随时删除单张图片或一键清空，删除会同时删掉图床中的图片。
        </span>
      </span>
      <Switch
        checked={enabled}
        onChange={onToggle}
        className="mt-0.5 shrink-0"
      />
    </label>
  );
}
