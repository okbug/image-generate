/** 激活码相关的常量和类型，前后端共用（这里不能引入 fs）。 */

/** 图片请求携带激活码的请求头。提示词优化不带它，始终走用户自己的 API。 */
export const ACTIVATION_HEADER = "x-image-activation-code";

/** 新建激活码时默认的每日限额（张），按北京时间每天 0 点重置。 */
export const DEFAULT_DAILY_LIMIT = 20;

/** 激活码要放进请求头，只允许可见 ASCII。 */
export const ACTIVATION_KEY_RE = /^[\x21-\x7E]{4,64}$/;

export type ActivationCode = {
  key: string;
  user: string;
  disabled: boolean;
  dailyLimit: number;
  createdAt: string;
};

export type ActivationCodeStats = ActivationCode & {
  usedToday: number;
  totalImages: number;
  totalCalls: number;
  lastUsedAt: string | null;
};

export type ActivationStatus = {
  user: string;
  dailyLimit: number;
  usedToday: number;
};

export type ActivationMode = "generate" | "edit";

/** 使用记录的一行。不记录提示词内容。 */
export type UsageRecord = {
  at: string;
  key: string;
  user: string;
  mode: ActivationMode;
  model: string;
  /** 页面上选择的画质（standard / hd）。 */
  quality: string;
  /** 实际发给官方的画质（auto / high）。 */
  upstreamQuality: string;
  size: string;
  /** 请求的张数。 */
  n: number;
  /** 实际拿到的张数，每日限额按它累计。 */
  images: number;
  referenceCount: number;
  ok: boolean;
  status: number;
  error?: string;
  ms: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  ip: string;
};

export type UsageSummary = {
  calls: number;
  successCalls: number;
  images: number;
  totalTokens: number;
};
