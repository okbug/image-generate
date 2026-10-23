"use client";

import { Select } from "antd";

import {
  IMAGE_MODEL_OPTIONS,
  type ImageModelOption,
  findImageModel,
} from "@/lib/models";

import {
  CUSTOM_SIZE_MAX,
  CUSTOM_SIZE_MIN,
  QUALITY_OPTIONS,
  SIZE_OPTIONS,
  clampSide,
} from "./constants";

/** 模型 / 尺寸 / 质量选择，以及自定义尺寸输入。 */
export function GenerationOptions({
  model,
  setModel,
  size,
  setSize,
  quality,
  setQuality,
  customWidth,
  setCustomWidth,
  customHeight,
  setCustomHeight,
  loading,
}: {
  model: string;
  setModel: (value: string) => void;
  size: string;
  setSize: (value: string) => void;
  quality: string;
  setQuality: (value: string) => void;
  customWidth: number;
  setCustomWidth: (value: number) => void;
  customHeight: number;
  setCustomHeight: (value: number) => void;
  loading: boolean;
}) {
  const activeModel = findImageModel(model);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-sand-800 dark:text-sand-200">
          模型
        </span>
        <Select
          value={model}
          onChange={setModel}
          size="large"
          options={IMAGE_MODEL_OPTIONS}
          optionRender={(option) => {
            const data = option.data as ImageModelOption;
            return (
              <div className="flex flex-col gap-0.5 py-1">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {data.label}
                  <span className="rounded-full bg-clay-50 px-1.5 py-0.5 text-[10px] font-medium text-clay-600 dark:bg-clay-500/15 dark:text-clay-300">
                    {data.tag}
                  </span>
                </span>
                <span className="text-xs leading-relaxed text-sand-500 dark:text-sand-400">
                  {data.description}
                </span>
              </div>
            );
          }}
          classNames={{ popup: { root: "model-select-popup" } }}
          placeholder="选择模型"
          className="w-full"
          disabled={loading}
        />
        <p className="text-[11px] leading-relaxed text-sand-500 dark:text-sand-500">
          {activeModel.tag} · {activeModel.description}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-sand-800 dark:text-sand-200">
          尺寸
        </span>
        <Select
          value={size}
          onChange={setSize}
          size="large"
          options={SIZE_OPTIONS}
          placeholder="选择尺寸"
          className="w-full"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-sand-800 dark:text-sand-200">
          质量
        </span>
        <Select
          value={quality}
          onChange={setQuality}
          size="large"
          options={QUALITY_OPTIONS}
          placeholder="选择质量"
          className="w-full"
        />
      </div>

      {size === "custom" && (
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-dashed border-clay-200 bg-clay-50/40 p-3 dark:border-clay-500/30 dark:bg-clay-500/5">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-sand-700 dark:text-sand-300">
              宽度（px）
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={CUSTOM_SIZE_MIN}
              max={CUSTOM_SIZE_MAX}
              step={64}
              value={customWidth}
              onChange={(e) => setCustomWidth(Number(e.target.value) || 0)}
              onBlur={(e) => setCustomWidth(clampSide(Number(e.target.value)))}
              className="h-10 w-full rounded-lg border border-sand-200 bg-white px-3 text-sm text-sand-900 outline-none transition focus:border-clay-400 focus:ring-4 focus:ring-clay-400/10 dark:border-sand-700 dark:bg-sand-900 dark:text-sand-100"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-sand-700 dark:text-sand-300">
              高度（px）
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={CUSTOM_SIZE_MIN}
              max={CUSTOM_SIZE_MAX}
              step={64}
              value={customHeight}
              onChange={(e) => setCustomHeight(Number(e.target.value) || 0)}
              onBlur={(e) => setCustomHeight(clampSide(Number(e.target.value)))}
              className="h-10 w-full rounded-lg border border-sand-200 bg-white px-3 text-sm text-sand-900 outline-none transition focus:border-clay-400 focus:ring-4 focus:ring-clay-400/10 dark:border-sand-700 dark:bg-sand-900 dark:text-sand-100"
            />
          </label>
          <p className="col-span-2 text-[11px] text-sand-500 dark:text-sand-400">
            范围 {CUSTOM_SIZE_MIN}–{CUSTOM_SIZE_MAX}px，建议 64 的倍数。
          </p>
        </div>
      )}
    </div>
  );
}
