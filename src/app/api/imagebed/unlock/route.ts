import { NextResponse } from "next/server";

import { isImagebedPassword } from "@/lib/upload-store";

export const runtime = "nodejs";

/** 密码错误时故意慢一点返回，减缓穷举。 */
const WRONG_PASSWORD_DELAY_MS = 800;

/** 图床页解锁：只校验密码，通过返回 ok。 */
export async function POST(req: Request) {
  let password: unknown;
  try {
    password = ((await req.json()) as { password?: unknown }).password;
  } catch {
    return NextResponse.json(
      { error: "请求体不是合法的 JSON" },
      { status: 400 },
    );
  }

  if (!isImagebedPassword(password)) {
    await new Promise((resolve) =>
      setTimeout(resolve, WRONG_PASSWORD_DELAY_MS),
    );
    return NextResponse.json({ error: "密码错误" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
