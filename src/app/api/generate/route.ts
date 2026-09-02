import { NextResponse } from "next/server";

import {
  MISSING_CREDENTIALS_MESSAGE,
  resolveCredentials,
} from "@/lib/api-credentials";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { billedUpstreamCall } from "@/lib/upstream";
import type { GenerateRequestBody } from "@/types/images";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const creds = resolveCredentials(req);
  if (!creds) {
    return NextResponse.json({ error: MISSING_CREDENTIALS_MESSAGE }, { status: 500 });
  }

  let body: Partial<GenerateRequestBody>;
  try {
    body = (await req.json()) as Partial<GenerateRequestBody>;
  } catch {
    return NextResponse.json({ error: "请求体不是合法的 JSON" }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: "prompt 不能为空" }, { status: 400 });
  }

  const n = Math.min(Math.max(Math.trunc(body.n ?? 1) || 1, 1), 4);
  const payload = {
    model: body.model ?? "gpt-image-2",
    prompt,
    size: body.size ?? "1792x1024",
    quality: body.quality ?? "standard",
    response_format: "b64_json" as const,
    n,
  };

  // 用户自带凭证时不扣费
  const unitPrice = creds.source === "custom" ? 0 : getSettings().priceGenerate;

  return billedUpstreamCall({
    user,
    cost: unitPrice * n,
    type: "generate",
    note: `生成 ${n} 张 · ${payload.size} · ${payload.quality}`,
    creds,
    pathname: "/v1/images/generations",
    payload,
  });
}
