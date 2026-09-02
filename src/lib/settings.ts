import type { PublicPrices } from "@/types/auth";

import { DEFAULT_SETTINGS, getDb } from "./db";

export type { PublicPrices };

export type AppSettings = {
  /** 单张生成价格（分） */
  priceGenerate: number;
  /** 单次编辑价格（分） */
  priceEdit: number;
  /** 单次提示词优化价格（分） */
  priceOptimize: number;
  /** 新用户注册赠送（分） */
  registerBonus: number;
  /** 默认生图后端（OpenAI 兼容）BaseURL，空表示回退到环境变量 */
  apiBaseUrl: string;
  apiKey: string;
};

const KEY_MAP: Record<keyof AppSettings, string> = {
  priceGenerate: "price_generate",
  priceEdit: "price_edit",
  priceOptimize: "price_optimize",
  registerBonus: "register_bonus",
  apiBaseUrl: "api_base_url",
  apiKey: "api_key",
};

function readInt(raw: string | undefined, fallback: string): number {
  const n = Number.parseInt(raw ?? fallback, 10);
  return Number.isFinite(n) && n >= 0 ? n : Number.parseInt(fallback, 10);
}

export function getSettings(): AppSettings {
  const rows = getDb()
    .prepare("SELECT key, value FROM settings")
    .all() as Array<{ key: string; value: string }>;
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const pick = (k: keyof AppSettings) => map.get(KEY_MAP[k]);

  return {
    priceGenerate: readInt(pick("priceGenerate"), DEFAULT_SETTINGS.price_generate),
    priceEdit: readInt(pick("priceEdit"), DEFAULT_SETTINGS.price_edit),
    priceOptimize: readInt(pick("priceOptimize"), DEFAULT_SETTINGS.price_optimize),
    registerBonus: readInt(pick("registerBonus"), DEFAULT_SETTINGS.register_bonus),
    apiBaseUrl: (pick("apiBaseUrl") ?? "").trim(),
    apiKey: (pick("apiKey") ?? "").trim(),
  };
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const db = getDb();
  const now = Date.now();
  const upsert = db.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
  );
  for (const [field, value] of Object.entries(patch) as Array<
    [keyof AppSettings, AppSettings[keyof AppSettings] | undefined]
  >) {
    if (value === undefined) continue;
    upsert.run(KEY_MAP[field], String(value), now);
  }
  return getSettings();
}

export function toPublicPrices(s: AppSettings): PublicPrices {
  return {
    generate: s.priceGenerate,
    edit: s.priceEdit,
    optimize: s.priceOptimize,
  };
}

/** 只露出末 4 位，用于后台回显 */
export function maskSecret(secret: string): string {
  if (!secret) return "";
  if (secret.length <= 8) return "****";
  return `${secret.slice(0, 3)}****${secret.slice(-4)}`;
}
