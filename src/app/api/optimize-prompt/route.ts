import { NextResponse } from "next/server";

import {
  MISSING_CREDENTIALS_ERROR,
  resolveCredentials,
} from "@/lib/api-credentials";
import { buildUpstreamHeaders } from "@/lib/client-info";
import { resolveOptimizeModel } from "@/lib/models";

export const runtime = "nodejs";

type OptimizeMode = "generate" | "edit";

type OptimizeBody = {
  prompt?: string;
  model?: string;
  mode?: OptimizeMode;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: { content?: string };
  }>;
};

const COMMON_RULES = `通用规则：
- 输出语言跟随用户输入：用户写中文就输出中文，写英文就输出英文；
- 用自然、具体的描述性句子，而不是堆砌关键词；不要写 "8K、杰作、最佳画质、trending on artstation" 这类空洞标签；
- 用正面描述代替否定句（写"背景干净的纯白色"，不写"不要杂乱背景"）；
- 画面中需要出现的文字，原样保留并用引号括起来，注明位置、字体风格和颜色；
- 用户已经明确的细节（数量、颜色、品牌、人物特征、尺寸比例、文字内容等）一个都不能改、不能丢；
- 用户的 prompt 已经很完整时，只做必要的润色和补充，不要为了显得专业而硬加内容；
- 只输出最终 prompt 本身：不要解释、不要标题、不要引号包裹、不要 Markdown、不要"优化后："之类的前缀。`;

const SYSTEM_PROMPTS: Record<OptimizeMode, string> = {
  generate: `你是一名资深的 AI 图像提示词工程师，负责把用户的想法改写成能让 gpt-image 系列模型稳定出好图的提示词。

改写方法：
1. 先抓住用户的核心意图：画的是什么、给谁看、用在哪里（海报、头像、商品图、插画、壁纸……），据此决定画面基调；
2. 按"主体 → 场景/背景 → 构图与视角 → 光线 → 色调 → 风格/媒介 → 细节与质感"的顺序组织描述，主体放在最前面；
3. 用户没指定的维度，选择最贴合意图的一个具体方案（例如具体到"清晨侧逆光""85mm 浅景深""扁平矢量插画"），不要罗列多个备选；
4. 风格要统一：写实摄影就用镜头、光线、材质的语言，插画就用画风、笔触、配色的语言，不要混用互相矛盾的风格；
5. 篇幅控制在 80–200 字（英文 60–150 词），一到三句话即可。

${COMMON_RULES}`,
  edit: `你是一名资深的 AI 修图提示词工程师。用户已经上传了参考图，接下来会用 gpt-image 系列模型基于参考图进行修改。
你看不到参考图，只能根据用户的文字，把"要怎么改"表达得清晰、可执行。

改写方法：
1. 明确修改对象和修改内容：改哪里、改成什么样，用具体的视觉描述（颜色、材质、位置、大小、风格）代替模糊的形容；
2. 明确保留范围：补一句"保持人物面部/姿态/构图/其余元素/光线不变"这类约束，具体保留什么要贴合用户的修改意图；
3. 如果用户提到多张参考图（例如"把图1的衣服换到图2的人身上"），保留这种指代关系并写清楚每张图的作用；
4. 不要重新描述整张画面，也不要编造参考图里可能并不存在的内容；
5. 篇幅控制在 40–150 字（英文 30–110 词）。

${COMMON_RULES}`,
};

function resolveMode(mode: unknown): OptimizeMode {
  return mode === "edit" ? "edit" : "generate";
}

/** 模型偶尔还是会带上代码块、引号或"优化后："前缀，这里兜底剥掉。 */
function cleanOutput(raw: string): string {
  let text = raw.trim();
  text = text.replace(/^```[\w-]*\s*\n?/, "").replace(/\n?```$/, "").trim();
  text = text
    .replace(/^(?:优化后(?:的)?(?:提示词|prompt)?|提示词|prompt|optimized prompt)\s*[:：]\s*/i, "")
    .trim();
  const pairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ["“", "”"],
    ["「", "」"],
    ["『", "』"],
  ];
  for (const [open, close] of pairs) {
    if (
      text.length > 2 &&
      text.startsWith(open) &&
      text.endsWith(close) &&
      !text.slice(1, -1).includes(close)
    ) {
      text = text.slice(1, -1).trim();
      break;
    }
  }
  return text;
}

export async function POST(req: Request) {
  const creds = resolveCredentials(req);
  if (!creds) {
    return NextResponse.json(
      { error: MISSING_CREDENTIALS_ERROR },
      { status: 401 },
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
            { role: "system", content: SYSTEM_PROMPTS[resolveMode(body.mode)] },
            { role: "user", content: original },
          ],
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

  const content = parsed.choices?.[0]?.message?.content;
  const optimized = typeof content === "string" ? cleanOutput(content) : "";
  if (!optimized) {
    return NextResponse.json(
      { error: "上游未返回有效内容", detail: text },
      { status: 502 },
    );
  }

  return NextResponse.json({ prompt: optimized });
}
