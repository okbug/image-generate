import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import {
  getSettings,
  maskSecret,
  updateSettings,
  type AppSettings,
} from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serialize(s: AppSettings) {
  return {
    priceGenerate: s.priceGenerate,
    priceEdit: s.priceEdit,
    priceOptimize: s.priceOptimize,
    registerBonus: s.registerBonus,
    apiBaseUrl: s.apiBaseUrl,
    apiKeySet: s.apiKey.length > 0,
    apiKeyMasked: maskSecret(s.apiKey),
  };
}

function envFallback() {
  const baseUrl = process.env.IMAGE_API_BASE_URL?.trim() ?? "";
  const apiKey = process.env.IMAGE_API_KEY?.trim() ?? "";
  return {
    apiBaseUrl: baseUrl,
    apiKeySet: apiKey.length > 0,
    apiKeyMasked: maskSecret(apiKey),
  };
}

/** GET /api/admin/settings */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  return NextResponse.json({
    settings: serialize(getSettings()),
    env: envFallback(),
  });
}

type Body = {
  priceGenerate?: number;
  priceEdit?: number;
  priceOptimize?: number;
  registerBonus?: number;
  apiBaseUrl?: string;
  /** 非空则更新；留空/不传表示保持不变 */
  apiKey?: string;
  /** 为 true 时清空已保存的 Key，回退到环境变量 */
  clearApiKey?: boolean;
};

function parseCents(value: unknown, label: string): number | string {
  if (value === undefined) return `${label}缺失`;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 1_000_000_000) {
    return `${label}必须是不小于 0 的整数（单位：分）`;
  }
  return n;
}

/** PUT /api/admin/settings */
export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "请求体不是合法的 JSON" }, { status: 400 });
  }

  const patch: Partial<AppSettings> = {};

  // 只列金额字段：它们在 AppSettings 与 Body 里都是 number，可安全批量校验
  type AmountField =
    | "priceGenerate"
    | "priceEdit"
    | "priceOptimize"
    | "registerBonus";
  const priceFields: Array<[AmountField, string]> = [
    ["priceGenerate", "生成单价"],
    ["priceEdit", "编辑单价"],
    ["priceOptimize", "提示词优化单价"],
    ["registerBonus", "注册赠送金额"],
  ];
  for (const [field, label] of priceFields) {
    if (body[field] === undefined) continue;
    const parsed = parseCents(body[field], label);
    if (typeof parsed === "string") {
      return NextResponse.json({ error: parsed }, { status: 400 });
    }
    patch[field] = parsed;
  }

  if (body.apiBaseUrl !== undefined) {
    const baseUrl = String(body.apiBaseUrl).trim().replace(/\/+$/, "");
    if (baseUrl && !/^https?:\/\/[^\s]+$/i.test(baseUrl)) {
      return NextResponse.json(
        { error: "BaseURL 需以 http(s):// 开头" },
        { status: 400 },
      );
    }
    patch.apiBaseUrl = baseUrl;
  }

  if (body.clearApiKey) {
    patch.apiKey = "";
  } else if (typeof body.apiKey === "string" && body.apiKey.trim()) {
    patch.apiKey = body.apiKey.trim();
  }

  const settings = updateSettings(patch);
  return NextResponse.json({
    settings: serialize(settings),
    env: envFallback(),
  });
}
