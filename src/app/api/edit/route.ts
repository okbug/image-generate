import { NextResponse } from "next/server";

import {
  MISSING_CREDENTIALS_ERROR,
  resolveCredentials,
} from "@/lib/api-credentials";
import { buildUpstreamHeaders } from "@/lib/client-info";
import { resolveImageModel } from "@/lib/models";

export const runtime = "nodejs";

type EditBody = {
  prompt?: string;
  imageUrl?: string;
  imageUrls?: string[];
  model?: string;
  size?: string;
  quality?: string;
};

export async function POST(req: Request) {
  const creds = resolveCredentials(req);
  if (!creds) {
    return NextResponse.json(
      { error: MISSING_CREDENTIALS_ERROR },
      { status: 401 },
    );
  }
  const { baseUrl, apiKey } = creds;

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

  const payload = {
    model: resolveImageModel(body.model),
    prompt,
    images: imageUrls.map((imageUrl) => ({ image_url: imageUrl })),
    size: body.size ?? "1024x1024",
    quality: body.quality ?? "standard",
    output_format: "png" as const,
    n: 1,
  };

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/images/edits`, {
      method: "POST",
      headers: buildUpstreamHeaders(req, {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `无法访问上游服务 (${baseUrl})`, detail: String(err) },
      { status: 502 },
    );
  }

  const text = await upstream.text();
  if (!upstream.ok) {
    return NextResponse.json(
      { error: `上游接口错误 (${upstream.status})`, detail: text },
      { status: upstream.status },
    );
  }

  try {
    return NextResponse.json(JSON.parse(text));
  } catch {
    return NextResponse.json(
      { error: "上游返回的不是合法 JSON", detail: text },
      { status: 502 },
    );
  }
}
