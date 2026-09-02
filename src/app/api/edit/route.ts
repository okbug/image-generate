import { NextResponse } from "next/server";

import {
  MISSING_CREDENTIALS_MESSAGE,
  resolveCredentials,
} from "@/lib/api-credentials";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { billedUpstreamCall } from "@/lib/upstream";

export const runtime = "nodejs";

const MAX_REFERENCE_IMAGES = 10;

type EditBody = {
  prompt?: string;
  imageUrl?: string;
  imageUrls?: string[];
  size?: string;
  quality?: string;
};

export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const creds = resolveCredentials(req);
  if (!creds) {
    return NextResponse.json({ error: MISSING_CREDENTIALS_MESSAGE }, { status: 500 });
  }

  let body: EditBody;
  try {
    body = (await req.json()) as EditBody;
  } catch {
    return NextResponse.json({ error: "请求体不是合法的 JSON" }, { status: 400 });
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
  if (imageUrls.length > MAX_REFERENCE_IMAGES) {
    return NextResponse.json(
      { error: `最多支持 ${MAX_REFERENCE_IMAGES} 张参考图片` },
      { status: 400 },
    );
  }
  if (imageUrls.some((url) => !/^https?:\/\//i.test(url))) {
    return NextResponse.json(
      { error: "图片 URL 需以 http(s):// 开头" },
      { status: 400 },
    );
  }

  const payload = {
    model: "gpt-image-2",
    prompt,
    images: imageUrls.map((imageUrl) => ({ image_url: imageUrl })),
    size: body.size ?? "1024x1024",
    quality: body.quality ?? "standard",
    output_format: "png" as const,
    n: 1,
  };

  const cost = creds.source === "custom" ? 0 : getSettings().priceEdit;

  return billedUpstreamCall({
    user,
    cost,
    type: "edit",
    note: `编辑 · ${imageUrls.length} 张参考图 · ${payload.size}`,
    creds,
    pathname: "/v1/images/edits",
    payload,
  });
}
