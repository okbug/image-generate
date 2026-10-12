/**
 * 上游模型配置。
 * 生图模型是固定的几档，前端下拉选择；优化提示词的模型允许用户在设置里自由填写，
 * 所以这里只给默认值。后端拿到的值一律走 resolve*，空值回落到默认模型。
 */
export type ImageModelOption = {
  value: string;
  label: string;
  tag: string;
  description: string;
};

export const DEFAULT_IMAGE_MODEL = "gpt-image-2";
export const DEFAULT_OPTIMIZE_MODEL = "gpt-6.1-sol";

export const IMAGE_MODEL_OPTIONS: ImageModelOption[] = [
  {
    value: "gpt-image-2",
    label: "gpt-image-2",
    tag: "默认",
    description:
      "老款，最稳。速度和画质均衡，出图风格最可预期，不确定选哪个就用它。",
  },
  {
    value: "gpt-image-2.5-flare",
    label: "gpt-image-2.5-flare",
    tag: "更快",
    description:
      "小杯快模型：比 gpt-image-2 快 2–4 倍，画质还更好一些，透明背景更干净。适合多试几版、社交配图、快速草稿。",
  },
  {
    value: "gpt-image-2.5-sunburst",
    label: "gpt-image-2.5-sunburst",
    tag: "更精细",
    description:
      "大杯精修款：出图更慢，但改图最听话——只动你要求改的地方，其余细节原样保留。适合广告图、商品图、品牌物料。",
  },
];

export function findImageModel(value: string): ImageModelOption {
  return (
    IMAGE_MODEL_OPTIONS.find((option) => option.value === value) ??
    IMAGE_MODEL_OPTIONS[0]
  );
}

function resolveModel(model: unknown, fallback: string): string {
  const value = typeof model === "string" ? model.trim() : "";
  if (!value || value.length > 100) return fallback;
  return value;
}

export function resolveImageModel(model: unknown): string {
  return resolveModel(model, DEFAULT_IMAGE_MODEL);
}

export function resolveOptimizeModel(model: unknown): string {
  return resolveModel(model, DEFAULT_OPTIMIZE_MODEL);
}
