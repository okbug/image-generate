import { NextResponse } from "next/server";

import {
  forwardImageRequest,
  isAccessError,
  resolveImageAccess,
} from "@/lib/image-access";
import {
  resolveImageCount,
  resolveImageModel,
  resolveImageQuality,
} from "@/lib/models";
import type { GenerateRequestBody } from "@/types/images";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: Partial<GenerateRequestBody>;
  try {
    body = (await req.json()) as Partial<GenerateRequestBody>;
  } catch {
    return NextResponse.json(
      { error: "请求体不是合法的 JSON" },
      { status: 400 },
    );
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: "prompt 不能为空" }, { status: 400 });
  }

  const model = resolveImageModel(body.model);
  const size = body.size ?? "1792x1024";
  const quality = body.quality ?? "standard";
  const n = resolveImageCount(body.n);

  const access = await resolveImageAccess(req, {
    mode: "generate",
    model,
    quality,
    size,
    n,
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
    quality: resolveImageQuality(quality, access.official),
    // 官方的 GPT 图片模型不接受这个参数（报 unknown_parameter），且总是返回 b64_json
    ...(access.official ? {} : { response_format: "b64_json" as const }),
    n,
  });
}
