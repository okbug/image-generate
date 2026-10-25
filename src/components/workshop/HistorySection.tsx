"use client";

import { useState } from "react";

import { App, Image, Switch } from "antd";
import { Download, History, Pencil, Trash2 } from "lucide-react";

import { type HistoryEntry, MAX_HISTORY } from "@/lib/use-generation-history";

function formatTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 删除图床里的一张图，成功返回 null，失败返回错误文案。 */
async function deleteRemote(entry: HistoryEntry): Promise<string | null> {
  try {
    const res = await fetch("/api/generated", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeKey: entry.storeKey,
        deleteToken: entry.deleteToken,
      }),
    });
    if (res.ok) return null;
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    return json.error ?? `删除失败 (${res.status})`;
  } catch (err) {
    return err instanceof Error ? err.message : "删除失败";
  }
}

/**
 * 首页底部「最近生成」：图存在图床，记录存在 localStorage，可编辑 / 下载 / 删除 / 一键清空。
 * 顶部的「保留记录」开关决定新生成的图要不要记到本地。
 */
export function HistorySection({
  entries,
  enabled,
  onToggle,
  onRemove,
  onEdit,
  editDisabled,
}: {
  entries: HistoryEntry[];
  enabled: boolean;
  onToggle: (next: boolean) => void;
  onRemove: (id: string) => void;
  onEdit: (entry: HistoryEntry) => void;
  editDisabled: boolean;
}) {
  const { modal, message } = App.useApp();
  const [clearing, setClearing] = useState(false);

  function handleClearAll() {
    modal.confirm({
      title: `清空全部 ${entries.length} 条记录？`,
      content:
        "会逐张删除图床中的这些图片，已经分享出去的链接也会失效，删除后无法恢复。",
      okText: "全部清空",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        setClearing(true);
        let failed = 0;
        // 逐张删，成功一张移除一张，失败的留在列表里方便重试
        for (const entry of entries) {
          const error = await deleteRemote(entry);
          if (error) failed += 1;
          else onRemove(entry.id);
        }
        setClearing(false);
        if (failed > 0) {
          void message.warning(`有 ${failed} 张删除失败，已保留在列表中`);
        } else {
          void message.success("已全部清空");
        }
      },
    });
  }

  function handleDelete(entry: HistoryEntry) {
    modal.confirm({
      title: "删除这张图片？",
      content:
        "图床里的这张图片会一起被删除，已经分享出去的链接也会失效，删除后无法恢复。",
      okText: "删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        const error = await deleteRemote(entry);
        if (error) {
          void message.error(error);
          return;
        }
        onRemove(entry.id);
        void message.success("已删除");
      },
    });
  }

  return (
    <section className="glass flex flex-col gap-4 rounded-2xl p-4 sm:rounded-3xl sm:p-5">
      <div className="flex flex-col gap-3 rounded-xl border border-sand-200 bg-sand-50/80 p-3 dark:border-sand-700 dark:bg-sand-900/40">
        <label className="flex items-start justify-between gap-3">
          <span className="flex flex-col gap-1">
            <span className="text-sm font-medium text-sand-800 dark:text-sand-200">
              在本地保留生成的图片
            </span>
            <span className="text-xs leading-relaxed text-sand-500 dark:text-sand-400">
              {enabled
                ? "已开启：生成的图片会自动保存到图床，并记录在当前浏览器中，方便随时找回。"
                : "已关闭：新生成的图片不再记录到本地（图片仍会保存到图床，请在生成后及时下载）。"}
              你可以随时删除单张图片或一键清空，删除会同时删掉图床中的图片。
            </span>
          </span>
          <Switch
            checked={enabled}
            onChange={onToggle}
            className="mt-0.5 shrink-0"
          />
        </label>
      </div>

      <div className="flex items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-sand-800 dark:text-sand-200">
          <History className="h-4 w-4 text-clay-600 dark:text-clay-400" />
          最近生成
          <span className="font-normal text-sand-500 dark:text-sand-400">
            {entries.length}/{MAX_HISTORY}
          </span>
        </h2>
        {entries.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            disabled={clearing}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-sand-200 px-3 text-xs text-sand-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sand-700 dark:text-sand-400 dark:hover:border-red-500/50 dark:hover:bg-red-500/10 dark:hover:text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {clearing ? "清空中…" : "一键清空"}
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="py-6 text-center text-xs text-sand-500 dark:text-sand-400">
          {enabled
            ? "还没有记录，生成的图片会出现在这里。"
            : "暂无记录。打开上方开关后，新生成的图片会出现在这里。"}
        </p>
      ) : (
        <p className="text-xs leading-relaxed text-sand-500 dark:text-sand-400">
          记录最多保留 {MAX_HISTORY}{" "}
          条，超出后自动移除最旧的记录（图床里的图片不受影响）；清除浏览器数据也会丢失这些记录。
        </p>
      )}

      {entries.length > 0 && (
        <Image.PreviewGroup>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {entries.map((entry) => (
              <figure
                key={entry.id}
                className="flex flex-col overflow-hidden rounded-xl border border-sand-200 bg-white/70 dark:border-sand-700 dark:bg-sand-900/50"
              >
                <Image
                  src={entry.url}
                  alt={entry.prompt}
                  className="!h-36 !w-full object-cover"
                  rootClassName="!block"
                  preview={{ mask: "预览" }}
                  fallback="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='144'><rect width='100%' height='100%' fill='%23e8e6dc'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='12' fill='%2387867f'>图片已失效</text></svg>"
                />
                <figcaption className="flex flex-1 flex-col gap-2 p-2.5 text-xs">
                  <p
                    title={entry.prompt}
                    className="line-clamp-2 leading-relaxed text-sand-700 dark:text-sand-300"
                  >
                    {entry.prompt}
                  </p>
                  <div className="mt-auto flex items-center justify-between gap-1">
                    <span className="truncate text-[11px] text-sand-500 dark:text-sand-500">
                      {formatTime(entry.createdAt)} ·{" "}
                      {entry.mode === "edit" ? "编辑" : "生成"}
                    </span>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => onEdit(entry)}
                        disabled={editDisabled}
                        title="作为参考图继续编辑"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-sand-600 transition hover:bg-clay-50 hover:text-clay-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-sand-400 dark:hover:bg-clay-500/10 dark:hover:text-clay-300"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <a
                        href={`${entry.url}?dl=1`}
                        title="下载"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-sand-600 transition hover:bg-clay-50 hover:text-clay-700 dark:text-sand-400 dark:hover:bg-clay-500/10 dark:hover:text-clay-300"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDelete(entry)}
                        title="删除（同时删除图床中的图片）"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-sand-600 transition hover:bg-red-50 hover:text-red-600 dark:text-sand-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </Image.PreviewGroup>
      )}
    </section>
  );
}
