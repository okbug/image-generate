import { NextResponse } from "next/server";

import { ACTIVATION_HEADER } from "@/lib/activation-shared";
import {
  forwardImageRequest,
  isAccessError,
  resolveImageAccess,
} from "@/lib/image-access";

export const runtime = "nodejs";

/** 动图仅开放给官方激活码用户，固定已验证能生成的模型、尺寸和格式。 */
export async function POST(req: Request) {
  if (!req.headers.get(ACTIVATION_HEADER)?.trim()) {
    return NextResponse.json(
      { error: "生成动图需要官方激活码" },
      { status: 403 },
    );
  }
  let body: { prompt?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "请求体不是合法的 JSON" },
      { status: 400 },
    );
  }
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json({ error: "prompt 不能为空" }, { status: 400 });
  }
  const model = "gpt-image-2.6-sunburst";
  const size = "512x512";
  const access = await resolveImageAccess(req, {
    mode: "generate",
    model,
    size,
    quality: "standard",
    n: 1,
    referenceCount: 0,
  });
  if (isAccessError(access)) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }
  return forwardImageRequest(req, access, "/v1/images/generations", {
    model,
    prompt,
    size,
    quality: "auto",
    output_format: "gif",
    n: 1,
  });
}
