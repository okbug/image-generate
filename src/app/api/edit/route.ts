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

export const runtime = "nodejs";

type EditBody = {
  prompt?: string;
  imageUrl?: string;
  imageUrls?: string[];
  model?: string;
  size?: string;
  quality?: string;
  n?: number;
};

export async function POST(req: Request) {
  let body: EditBody;
  try {
    body = (await req.json()) as EditBody;
  } catch {
    return NextResponse.json(
      { error: "请求体不是合法的 JSON" },
      { status: 400 },
    );
  }

  const prompt = body.prompt?.trim();
  const imageUrls = Array.from(
    new Set(
      (Array.isArray(body.imageUrls) ? body.imageUrls : [body.imageUrl])
        .map((url) => (typeof url === "string" ? url.trim() : ""))
        .filter(Boolean),
    ),
  );
  if (!prompt) {
    return NextResponse.json({ error: "prompt 不能为空" }, { status: 400 });
  }
  if (imageUrls.length === 0) {
    return NextResponse.json({ error: "imageUrls 不能为空" }, { status: 400 });
  }
  if (imageUrls.length > 10) {
    return NextResponse.json(
      { error: "最多支持 10 张参考图片" },
      { status: 400 },
    );
  }
  if (imageUrls.some((url) => !/^https?:\/\//i.test(url))) {
    return NextResponse.json(
      { error: "图片 URL 需以 http(s):// 开头" },
      { status: 400 },
    );
  }

  const model = resolveImageModel(body.model);
  const size = body.size ?? "1024x1024";
  const quality = body.quality ?? "standard";
  const n = resolveImageCount(body.n);

  const access = await resolveImageAccess(req, {
    mode: "edit",
    model,
    quality,
    size,
    n,
    referenceCount: imageUrls.length,
  });
  if (isAccessError(access)) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  return forwardImageRequest(req, access, "/v1/images/edits", {
    model,
    prompt,
    images: imageUrls.map((imageUrl) => ({ image_url: imageUrl })),
    size,
    quality: resolveImageQuality(quality, access.official),
    output_format: "png" as const,
    n,
  });
}
