"use client";

import { useState, useSyncExternalStore } from "react";

import { Modal } from "antd";
import {
  CloudCheck,
  History,
  type LucideIcon,
  ToggleRight,
  Trash2,
} from "lucide-react";

type ReleaseItem = {
  icon: LucideIcon;
  title: string;
  desc: string;
};

/**
 * 更新记录，最新的放最前面。以后有更新就在数组开头**追加**一条（新日期 + 内容），不要改旧的。
 * 弹窗按日期分组展示全部记录。
 */
const RELEASES: { date: string; items: ReleaseItem[] }[] = [
  {
    date: "2026-10-25",
    items: [
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
    ],
  },
];

/**
 * 更新说明弹窗：每次进入首页都弹，点「不再提醒」后在 localStorage 记一笔就不再弹。
 * key 跟着最新一条记录的日期走，追加新记录后所有人会重新看到一次。
 */
const DISMISS_KEY = `image-generator:update-notice-dismissed:${RELEASES[0].date}`;

/** 2026-10-25 → 2026 年 10 月 25 日 */
function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${y} 年 ${m} 月 ${d} 日`;
}

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
      title="更新记录"
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
      <div className="flex max-h-[60vh] flex-col gap-5 overflow-y-auto py-2 pr-1">
        {RELEASES.map((release, index) => (
          <section key={release.date} className="flex flex-col gap-3">
            <h3 className="inline-flex items-center gap-2 text-xs font-semibold text-sand-500 dark:text-sand-400">
              {formatDate(release.date)}
              {index === 0 && (
                <span className="rounded-full bg-clay-50 px-1.5 py-0.5 text-[10px] font-medium text-clay-600 dark:bg-clay-500/15 dark:text-clay-300">
                  最新
                </span>
              )}
            </h3>
            <ul className="flex flex-col gap-3">
              {release.items.map(({ icon: Icon, title, desc }) => (
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
          </section>
        ))}
      </div>
    </Modal>
  );
}
