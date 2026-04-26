import { NextResponse } from "next/server";

import { resolveCredentials } from "@/lib/api-credentials";
import type { GenerateRequestBody } from "@/types/images";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const creds = resolveCredentials(req);
  if (!creds) {
    return NextResponse.json(
      { error: "缺少 API 凭证（环境变量或自定义凭证均未设置）" },
      { status: 500 },
    );
  }
  const { baseUrl, apiKey } = creds;

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

  const payload = {
    model: body.model ?? "gpt-image-2",
    prompt,
    size: body.size ?? "1792x1024",
    response_format: "b64_json" as const,
    n: Math.min(Math.max(body.n ?? 1, 1), 4),
  };

  let upstream: Response;
  try {
    upstream = await fetch(
      `${baseUrl.replace(/\/$/, "")}/v1/images/generations`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
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
