import { NextResponse } from "next/server";

import {
  MISSING_CREDENTIALS_MESSAGE,
  resolveCredentials,
} from "@/lib/api-credentials";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { billedUpstreamCall } from "@/lib/upstream";

export const runtime = "nodejs";

type OptimizeBody = {
  prompt?: string;
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
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const creds = resolveCredentials(req);
  if (!creds) {
    return NextResponse.json({ error: MISSING_CREDENTIALS_MESSAGE }, { status: 500 });
  }

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

  const cost = creds.source === "custom" ? 0 : getSettings().priceOptimize;

  return billedUpstreamCall({
    user,
    cost,
    type: "optimize",
    note: "优化提示词",
    creds,
    pathname: "/v1/chat/completions",
    payload: {
      model: "gpt-5.5",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: original },
      ],
      temperature: 0.7,
    },
    mapSuccess: (data) => {
      const optimized = (data as ChatCompletionResponse).choices?.[0]?.message
        ?.content?.trim();
      if (!optimized) {
        return {
          ok: false,
          status: 502,
          error: "上游未返回有效内容",
          detail: JSON.stringify(data),
        };
      }
      return { prompt: optimized };
    },
  });
}
