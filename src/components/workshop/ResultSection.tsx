"use client";

import { useState } from "react";

import { CloudCheck, Clock } from "lucide-react";

import { formatDuration } from "@/lib/use-timings";
import {
  type ImageItem,
  type ImageUsage,
  type ImagesGenerationsResponse,
  extFromFormat,
  mimeFromFormat,
} from "@/types/images";

import type { RenderedItem } from "./constants";

/** 把接口返回的图片（b64 或 URL）统一成可直接展示 / 下载的条目。 */
export function toRenderedItems(
  result: ImagesGenerationsResponse | null,
): RenderedItem[] {
  return (result?.data ?? []).flatMap((item: ImageItem): RenderedItem[] => {
    const ext = extFromFormat(result?.output_format);
    if (item.b64_json) {
      const mime = mimeFromFormat(result?.output_format);
      return [
        {
          src: `data:${mime};base64,${item.b64_json}`,
          revisedPrompt: item.revised_prompt,
          ext,
          bytes: base64ByteLength(item.b64_json),
        },
      ];
    }
    if (item.url) {
      // 本站落盘的临时图会带上 bytes；外部 URL 拿不到大小
      return [
        {
          src: item.url,
          revisedPrompt: item.revised_prompt,
          ext,
          bytes: item.bytes,
          downloadHref: item.storeKey ? `${item.url}?dl=1` : undefined,
          storeKey: item.storeKey,
          deleteToken: item.deleteToken,
        },
      ];
    }
    return [];
  });
}

/** base64 解码后的字节数：每 4 个字符 3 字节，再扣掉末尾的 = 填充。 */
function base64ByteLength(b64: string): number {
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** 出图结果：概要信息 + 每张图一张卡片。 */
export function ResultSection({
  result,
  renderedItems,
  lastDurationMs,
  onEditResult,
  editDisabled,
  historyEnabled,
  deletedKeys,
}: {
  result: ImagesGenerationsResponse;
  renderedItems: RenderedItem[];
  lastDurationMs: number | null;
  onEditResult: (item: RenderedItem, index: number) => void;
  editDisabled: boolean;
  historyEnabled: boolean;
  /** 本页已从图床删掉的 storeKey，对应的结果不能再编辑 / 下载 */
  deletedKeys: ReadonlySet<string>;
}) {
  // 存进图床的会进「最近生成」；图床失败回落到本站临时目录的，30 分钟后会被清理
  const hasPicbedImage = renderedItems.some(
    (item) => item.storeKey && !deletedKeys.has(item.storeKey),
  );
  const hasTmpImage = renderedItems.some((item) =>
    item.src.includes("/images/tmp/"),
  );

  return (
    <section className="flex flex-col gap-5">
      <ResultMeta
        result={result}
        renderedItems={renderedItems}
        durationMs={lastDurationMs}
      />
      <div
        className={`grid gap-4 ${
          renderedItems.length > 1
            ? "grid-cols-1 md:grid-cols-2"
            : "grid-cols-1"
        }`}
      >
        {renderedItems.map((item, idx) => (
          <ResultCard
            key={idx}
            index={idx}
            item={item}
            createdAt={result.created}
            onEdit={() => onEditResult(item, idx)}
            editDisabled={editDisabled}
            deleted={Boolean(item.storeKey && deletedKeys.has(item.storeKey))}
          />
        ))}
      </div>
      {hasPicbedImage && (
        <p className="inline-flex items-center gap-1.5 text-xs text-sand-500 dark:text-sand-400">
          <CloudCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          {historyEnabled
            ? "已自动保存到图床，可在页面底部「最近生成」中随时找回。"
            : "已保存到图床；你关闭了「在本地保留」，刷新后将无法在本页找回，请及时下载。"}
        </p>
      )}
      {hasTmpImage && (
        <p className="inline-flex items-center gap-1.5 text-xs text-sand-500 dark:text-sand-400">
          <Clock className="h-3.5 w-3.5" />
          图片链接 30 分钟内有效，之后会被自动清理，需要保留请及时下载。
        </p>
      )}
    </section>
  );
}

function ResultMeta({
  result,
  renderedItems,
  durationMs,
}: {
  result: ImagesGenerationsResponse;
  renderedItems: RenderedItem[];
  durationMs: number | null;
}) {
  const usage = result.usage;
  // 只要有一张拿不到大小（URL 返回），就不显示合计，免得数字偏小
  const totalBytes = renderedItems.every((item) => item.bytes !== undefined)
    ? renderedItems.reduce((sum, item) => sum + (item.bytes ?? 0), 0)
    : null;
  return (
    <div className="glass flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl p-3 text-xs text-sand-600 dark:text-sand-400 sm:gap-x-6 sm:p-4">
      <MetaPill label="模型" value={result.model ?? "-"} />
      <MetaPill label="尺寸" value={result.size ?? "-"} />
      {result.quality && <MetaPill label="质量" value={result.quality} />}
      {result.output_format && (
        <MetaPill
          label="格式"
          value={String(result.output_format).toUpperCase()}
        />
      )}
      {totalBytes !== null && totalBytes > 0 && (
        <MetaPill
          label={renderedItems.length > 1 ? "总大小" : "大小"}
          value={formatBytes(totalBytes)}
        />
      )}
      {durationMs !== null && (
        <MetaPill label="耗时" value={formatDuration(durationMs)} />
      )}
      {usage && <UsageInfo usage={usage} />}
    </div>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-sand-500 dark:text-sand-500">{label}</span>
      <span className="font-medium text-sand-800 dark:text-sand-200">
        {value}
      </span>
    </span>
  );
}

function UsageInfo({ usage }: { usage: ImageUsage }) {
  return (
    <span className="inline-flex w-full items-center gap-1.5 rounded-full bg-sand-100/80 px-2.5 py-1 dark:bg-sand-800/60 sm:ml-auto sm:w-auto">
      <span className="text-sand-500 dark:text-sand-500">tokens</span>
      <span className="font-medium text-sand-800 dark:text-sand-200">
        输入 {usage.input_tokens} · 输出 {usage.output_tokens} · 总{" "}
        {usage.total_tokens}
      </span>
    </span>
  );
}

function ResultCard({
  item,
  index,
  createdAt,
  onEdit,
  editDisabled,
  deleted,
}: {
  item: RenderedItem;
  index: number;
  createdAt: number;
  onEdit: () => void;
  editDisabled: boolean;
  /** 已从图床删除：链接已失效，编辑 / 下载都会 404 */
  deleted: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const fileName = `image-${createdAt}-${index + 1}.${item.ext}`;

  return (
    <figure className="glass overflow-hidden rounded-2xl sm:rounded-3xl">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.src}
          alt={`生成结果 ${index + 1}`}
          className={`block h-auto w-full ${deleted ? "opacity-30 grayscale" : ""}`}
        />
        {deleted && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-sand-900/80 px-4 py-2 text-xs font-medium text-white">
              已从图床删除，链接已失效
            </span>
          </div>
        )}
      </div>
      <figcaption className="flex flex-col gap-3 p-4 sm:px-5 sm:py-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-sand-700 dark:text-sand-300">
            #{index + 1} 作品
            {item.bytes !== undefined && (
              <span className="ml-2 font-normal text-sand-500 dark:text-sand-500">
                {formatBytes(item.bytes)}
              </span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onEdit}
              disabled={editDisabled || deleted}
              title={
                deleted
                  ? "图片已从图床删除，无法继续编辑"
                  : "把这张图作为参考图，继续修改"
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-clay-200 bg-clay-50/70 px-3.5 text-xs font-medium text-clay-700 transition active:scale-95 hover:border-clay-300 hover:bg-clay-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-clay-500/40 dark:bg-clay-500/10 dark:text-clay-300 dark:hover:border-clay-400/60 dark:hover:bg-clay-500/20"
            >
              ✏️ 编辑该图片
            </button>
            {deleted ? (
              <span
                title="图片已从图床删除，无法下载"
                className="inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-lg bg-sand-900 px-3.5 text-xs font-medium text-white opacity-50 dark:bg-white dark:text-sand-900"
              >
                ↓ 下载
              </span>
            ) : (
              <a
                href={item.downloadHref ?? item.src}
                download={fileName}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-sand-900 px-3.5 text-xs font-medium text-white transition active:scale-95 hover:bg-sand-700 dark:bg-white dark:text-sand-900 dark:hover:bg-sand-200"
              >
                ↓ 下载
              </a>
            )}
          </div>
        </div>

        {item.revisedPrompt && (
          <details
            open={expanded}
            onToggle={(e) => setExpanded((e.target as HTMLDetailsElement).open)}
            className="group rounded-xl border border-sand-200/80 bg-white/50 p-3 text-xs leading-relaxed text-sand-600 transition dark:border-sand-800 dark:bg-sand-900/40 dark:text-sand-300"
          >
            <summary className="cursor-pointer list-none font-medium text-sand-700 marker:hidden dark:text-sand-200">
              <span className="inline-flex items-center gap-1.5">
                <span className="transition group-open:rotate-90">▸</span>
                模型改写后的 Prompt
              </span>
            </summary>
            <p className="mt-2 whitespace-pre-wrap text-sand-600 dark:text-sand-400">
              {item.revisedPrompt}
            </p>
          </details>
        )}
      </figcaption>
    </figure>
  );
}
