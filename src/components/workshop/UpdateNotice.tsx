"use client";

import { useState, useSyncExternalStore } from "react";

import { Modal } from "antd";
import { CloudCheck, History, ToggleRight, Trash2 } from "lucide-react";

/**
 * 本次更新的说明弹窗：每次进入首页都弹，点「不再提醒」后在 localStorage 记一笔就不再弹。
 * 以后有新的更新说明时换一个 key，所有人会重新看到。
 */
const DISMISS_KEY = "image-generator:update-notice-dismissed:2026-10-25";

function subscribe() {
  return () => {};
}

function getDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/** 服务端渲染时先当作已关闭，避免闪一下。 */
function getServerDismissed(): boolean {
  return true;
}

const ITEMS = [
  {
    icon: CloudCheck,
    title: "生成的图片自动保存到图床",
    desc: "不再是只在页面里的临时图片，刷新后也能通过链接访问和分享。",
  },
  {
    icon: History,
    title: "新增「最近生成」",
    desc: "页面底部会列出最近生成的图片（最多 200 张，超出后自动删除最旧的），可以预览、下载，或作为参考图继续编辑。",
  },
  {
    icon: ToggleRight,
    title: "可选择是否在本地保留",
    desc: "生图按钮上方的「在本地保留生成的图片」开关默认开启，记录只存在当前浏览器，关闭后不再记录新图片。",
  },
  {
    icon: Trash2,
    title: "随时删除或一键清空",
    desc: "删除单张或一键清空时，会同时删除图床中的图片，链接随即失效。",
  },
];

export function UpdateNotice() {
  const dismissed = useSyncExternalStore(
    subscribe,
    getDismissed,
    getServerDismissed,
  );
  const [closed, setClosed] = useState(false);

  function handleNeverShow() {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // 存不了就只关这一次
    }
    setClosed(true);
  }

  return (
    <Modal
      open={!dismissed && !closed}
      title="本次更新"
      onCancel={() => setClosed(true)}
      footer={[
        <button
          key="never"
          type="button"
          onClick={handleNeverShow}
          className="mr-2 inline-flex h-9 items-center rounded-lg border border-sand-200 px-4 text-sm text-sand-600 transition hover:border-sand-300 hover:text-sand-900 dark:border-sand-700 dark:text-sand-300 dark:hover:text-white"
        >
          不再提醒
        </button>,
        <button
          key="ok"
          type="button"
          onClick={() => setClosed(true)}
          className="inline-flex h-9 items-center rounded-lg bg-clay-600 px-4 text-sm font-semibold text-white transition hover:bg-clay-700 dark:bg-clay-500 dark:hover:bg-clay-400"
        >
          我知道了
        </button>,
      ]}
    >
      <ul className="flex flex-col gap-3 py-2">
        {ITEMS.map(({ icon: Icon, title, desc }) => (
          <li key={title} className="flex gap-3">
            <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-clay-50 text-clay-600 dark:bg-clay-500/15 dark:text-clay-300">
              <Icon className="h-4 w-4" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-sand-900 dark:text-sand-100">
                {title}
              </span>
              <span className="text-xs leading-relaxed text-sand-500 dark:text-sand-400">
                {desc}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
