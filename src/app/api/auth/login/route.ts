import { NextResponse } from "next/server";

import {
  createSession,
  findUserByUsername,
  setSessionCookie,
  toSessionUser,
} from "@/lib/auth";
import { verifyPassword } from "@/lib/password";

export const runtime = "nodejs";

type Body = {
  username?: string;
  password?: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "请求体不是合法的 JSON" }, { status: 400 });
  }

  const username = body.username?.trim() ?? "";
  const password = body.password ?? "";
  if (!username || !password) {
    return NextResponse.json({ error: "请输入用户名和密码" }, { status: 400 });
  }

  const user = findUserByUsername(username);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
  }

  const { token, expiresAt } = createSession(user.id);
  await setSessionCookie(req, token, expiresAt);

  return NextResponse.json({
    user: toSessionUser({ ...user, last_login_at: Date.now() }),
  });
}
