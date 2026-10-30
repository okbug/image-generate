import { NextResponse } from "next/server";

import {
  MISSING_CREDENTIALS_ERROR,
  resolveCredentials,
} from "@/lib/api-credentials";
import { buildUpstreamHeaders } from "@/lib/client-info";
import { describeFetchError } from "@/lib/fetch-error";
import { storeGeneratedImages } from "@/lib/generated-images";
import { resolveImageCount, resolveImageModel } from "@/lib/models";
import type {
  GenerateRequestBody,
  ImagesGenerationsResponse,
} from "@/types/images";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const creds = resolveCredentials(req);
  if (!creds) {
    return NextResponse.json(
      { error: MISSING_CREDENTIALS_ERROR },
      { status: 401 },
    );
  }
  const { baseUrl, apiKey } = creds;

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

  const payload = {
    model: resolveImageModel(body.model),
    prompt,
    size: body.size ?? "1792x1024",
    quality: body.quality ?? "standard",
    response_format: "b64_json" as const,
    n: resolveImageCount(body.n),
  };

  let upstream: Response;
  try {
    upstream = await fetch(
      `${baseUrl.replace(/\/$/, "")}/v1/images/generations`,
      {
        method: "POST",
        headers: buildUpstreamHeaders(req, {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(payload),
      },
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: `无法访问上游服务 (${baseUrl})`,
        detail: describeFetchError(err),
      },
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

  let result: ImagesGenerationsResponse;
  try {
    result = JSON.parse(text) as ImagesGenerationsResponse;
  } catch {
    return NextResponse.json(
      { error: "上游返回的不是合法 JSON", detail: text },
      { status: 502 },
    );
  }

  // 图片落盘为临时文件，响应里只回 URL
  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  return NextResponse.json(await storeGeneratedImages(result, origin));
}
