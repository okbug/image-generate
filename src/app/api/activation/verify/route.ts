import { NextResponse } from "next/server";

import { getActivationStatus } from "@/lib/activation";
import { ACTIVATION_KEY_RE } from "@/lib/activation-shared";

export const runtime = "nodejs";

/** 激活码错误时故意慢一点返回，减缓穷举。 */
const WRONG_CODE_DELAY_MS = 800;

/** 设置弹窗里校验激活码，通过后返回使用人和今日额度。 */
export async function POST(req: Request) {
  let code: unknown;
  try {
    code = ((await req.json()) as { code?: unknown }).code;
  } catch {
    return NextResponse.json(
      { error: "请求体不是合法的 JSON" },
      { status: 400 },
    );
  }

  const key = typeof code === "string" ? code.trim() : "";
  const status = ACTIVATION_KEY_RE.test(key)
    ? await getActivationStatus(key)
    : null;
  if (!status) {
    await new Promise((resolve) => setTimeout(resolve, WRONG_CODE_DELAY_MS));
    return NextResponse.json({ error: "激活码无效或已停用" }, { status: 403 });
  }
  return NextResponse.json(status);
}
