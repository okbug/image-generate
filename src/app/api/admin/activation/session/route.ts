import { NextResponse, type NextRequest } from "next/server";

import {
  clearAdminCookie,
  isAdminPassword,
  isAdminRequest,
  setAdminCookie,
} from "@/lib/activation-admin";

export const runtime = "nodejs";

/** 密码错误时故意慢一点返回，减缓穷举。 */
const WRONG_PASSWORD_DELAY_MS = 800;

export async function GET(req: NextRequest) {
  return NextResponse.json({ loggedIn: isAdminRequest(req) });
}

export async function POST(req: NextRequest) {
  let password: unknown;
  try {
    password = ((await req.json()) as { password?: unknown }).password;
  } catch {
    return NextResponse.json(
      { error: "请求体不是合法的 JSON" },
      { status: 400 },
    );
  }

  if (!isAdminPassword(password)) {
    await new Promise((resolve) =>
      setTimeout(resolve, WRONG_PASSWORD_DELAY_MS),
    );
    return NextResponse.json({ error: "密码错误" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  setAdminCookie(res, req);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  clearAdminCookie(res);
  return res;
}
