"use client";

import { App, Button, Switch } from "antd";

/**
 * 生图按钮上方的「在本地保留生成的图片」开关，决定出图结果要不要记进「最近生成」。
 * 关闭时如果还有记录，弹窗三选一：取消（开关保持开启）/ 不清空（只关开关）/
 * 清空（关开关并连图床文件一起删，清空完成后弹窗才关闭）。
 */
export function KeepHistorySwitch({
  enabled,
  onToggle,
  entryCount,
  onClearAll,
}: {
  enabled: boolean;
  onToggle: (next: boolean) => void;
  entryCount: number;
  /** 返回删除失败的张数 */
  onClearAll: () => Promise<number>;
}) {
  const { modal, message } = App.useApp();

  function handleChange(next: boolean) {
    if (next || entryCount === 0) {
      onToggle(next);
      return;
    }
    // 开关先不动，等用户在弹窗里选了「不清空 / 清空」才真正关闭；取消、Esc、点遮罩都保持开启
    const instance = modal.confirm({
      title: "关闭后要清空本地保存的所有图片吗？",
      content: `「最近生成」中还有 ${entryCount} 张图片。清空会同时删除图床中的这些图片，已分享的链接会失效，且无法恢复；不清空则保留现有记录，之后仍可手动删除；取消则不关闭开关。`,
      okText: "清空",
      okButtonProps: { danger: true },
      cancelText: "取消",
      footer: (_, { OkBtn, CancelBtn }) => (
        <>
          <CancelBtn />
          <Button
            onClick={() => {
              onToggle(false);
              instance.destroy();
            }}
          >
            不清空
          </Button>
          <OkBtn />
        </>
      ),
      onOk: async () => {
        onToggle(false);
        // onOk 返回的 Promise 结束前按钮保持 loading，清空完成后弹窗才关闭
        const failed = await onClearAll();
        if (failed > 0) {
          void message.warning(
            `有 ${failed} 张删除失败，已保留在「最近生成」中`,
          );
        } else {
          void message.success("已清空本地保存的图片");
        }
      },
    });
  }

  return (
    // 用 div 而不是 label：label 会把点击文字转发给开关，误触就切换了
    <div className="flex items-start justify-between gap-3 rounded-xl border border-sand-200 bg-sand-50/80 p-3 dark:border-sand-700 dark:bg-sand-900/40">
      <span className="flex flex-col gap-1">
        <span
          id="keep-history-label"
          className="text-sm font-medium text-sand-800 dark:text-sand-200"
        >
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
        aria-labelledby="keep-history-label"
        checked={enabled}
        onChange={handleChange}
        className="mt-0.5 shrink-0"
      />
    </div>
  );
}
