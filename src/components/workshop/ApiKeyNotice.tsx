"use client";

/** 没填自己的 API 凭证时，表单顶部的提示条。 */
export function ApiKeyNotice({
  onOpenSettings,
}: {
  onOpenSettings: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-clay-200 bg-clay-50 px-4 py-3 text-sm text-clay-800 sm:flex-row sm:items-center sm:justify-between dark:border-clay-700/40 dark:bg-clay-500/10 dark:text-clay-200">
      <p className="leading-relaxed">
        <span className="font-semibold">🔑 请先填写 API 地址和 Key。</span>
        本站不提供默认额度，生成、编辑图片和优化提示词都要用你自己的 API。
      </p>
      <button
        type="button"
        onClick={onOpenSettings}
        className="inline-flex h-9 shrink-0 items-center justify-center self-start rounded-full bg-clay-600 px-4 text-xs font-semibold text-white transition active:scale-95 hover:bg-clay-700 dark:bg-clay-500 dark:hover:bg-clay-400 sm:self-auto"
      >
        去填写
      </button>
    </div>
  );
}
