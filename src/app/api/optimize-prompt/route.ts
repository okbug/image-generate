import { NextResponse } from "next/server";

import { resolveCredentials } from "@/lib/api-credentials";
import { buildUpstreamHeaders } from "@/lib/client-info";
import { resolveOptimizeModel } from "@/lib/models";

export const runtime = "nodejs";

type OptimizeBody = {
  prompt?: string;
  model?: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: { content?: string };
  }>;
};

const SYSTEM_PROMPT = `你是一名专业的 AI 图像生成提示词优化助手。
你的任务：把用户给出的简短中文 prompt 改写得更适合 gpt-image-2 这类图像模型，
要求：
1. 保留用户的核心意图，不要改变主体、不要凭空添加无关元素；
2. 补充关键视觉信息：风格 / 构图 / 光线 / 色调 / 材质 / 镜头 / 氛围；
3. 用中文，控制在 120 字以内，逗号分隔短句，避免冗长句子；
4. 不要输出任何解释、引号、前缀（如"优化后："），直接输出最终 prompt。`;

export async function POST(req: Request) {
  const creds = resolveCredentials(req);
  if (!creds) {
    return NextResponse.json(
      { error: "缺少 API 凭证（环境变量或自定义凭证均未设置）" },
      { status: 500 },
    );
  }
  const { baseUrl, apiKey } = creds;

  let body: OptimizeBody;
  try {
    body = (await req.json()) as OptimizeBody;
  } catch {
    return NextResponse.json({ error: "请求体不是合法的 JSON" }, { status: 400 });
  }

  const original = body.prompt?.trim();
  if (!original) {
    return NextResponse.json({ error: "prompt 不能为空" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`,
      {
        method: "POST",
        headers: buildUpstreamHeaders(req, {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          model: resolveOptimizeModel(body.model),
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: original },
          ],
          temperature: 0.7,
        }),
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

  let parsed: ChatCompletionResponse;
  try {
    parsed = JSON.parse(text) as ChatCompletionResponse;
  } catch {
    return NextResponse.json(
      { error: "上游返回的不是合法 JSON", detail: text },
      { status: 502 },
    );
  }

  const optimized = parsed.choices?.[0]?.message?.content?.trim();
  if (!optimized) {
    return NextResponse.json(
      { error: "上游未返回有效内容", detail: text },
      { status: 502 },
    );
  }

  return NextResponse.json({ prompt: optimized });
}
