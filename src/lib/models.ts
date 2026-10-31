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

export const DEFAULT_IMAGE_MODEL = "gpt-image-2.5-sunburst";
export const DEFAULT_OPTIMIZE_MODEL = "gpt-6.1-sol";

// 默认模型放第一项：findImageModel 找不到时回落到 [0]
export const IMAGE_MODEL_OPTIONS: ImageModelOption[] = [
  {
    value: "gpt-image-2.5-sunburst",
    label: "gpt-image-2.5-sunburst",
    tag: "默认 · 更精细",
    description:
      "大杯精修款：出图更慢，但改图最听话——只动你要求改的地方，其余细节原样保留。适合广告图、商品图、品牌物料。",
  },
  {
    value: "gpt-image-2",
    label: "gpt-image-2",
    tag: "最稳",
    description: "老款，最稳。速度和画质均衡，出图风格最可预期。",
  },
  {
    value: "gpt-image-2.5-flare",
    label: "gpt-image-2.5-flare",
    tag: "更快",
    description:
      "小杯快模型：比 gpt-image-2 快 2–4 倍，画质还更好一些，透明背景更干净。适合多试几版、社交配图、快速草稿。",
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

/** 优化提示词时的思考强度（上游 reasoning_effort），默认放数组里的 DEFAULT_REASONING_EFFORT。 */
export const REASONING_EFFORT_OPTIONS = [
  { value: "low", label: "low" },
  { value: "medium", label: "medium" },
  { value: "high", label: "high" },
  { value: "max", label: "max" },
] as const;

export type ReasoningEffort =
  (typeof REASONING_EFFORT_OPTIONS)[number]["value"];

export const DEFAULT_REASONING_EFFORT: ReasoningEffort = "high";

/** 前端存储和后端请求体共用：不在四档里的值一律回落到默认档。 */
export function resolveReasoningEffort(value: unknown): ReasoningEffort {
  return (
    REASONING_EFFORT_OPTIONS.find((option) => option.value === value)?.value ??
    DEFAULT_REASONING_EFFORT
  );
}

/** 一次最多出几张图（上游 n 参数），前端下拉和后端校验共用。 */
export const MAX_IMAGE_COUNT = 4;

/** 非法值回落到 1，超出范围则夹到 1~MAX_IMAGE_COUNT。 */
export function resolveImageCount(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 1;
  return Math.min(Math.max(Math.round(n), 1), MAX_IMAGE_COUNT);
}
