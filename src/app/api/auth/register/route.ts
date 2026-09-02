import { NextResponse } from "next/server";

import {
  createSession,
  createUser,
  findUserByUsername,
  setSessionCookie,
  toSessionUser,
} from "@/lib/auth";
import { applyBalanceChange } from "@/lib/billing";
import {
  hashPassword,
  validatePassword,
  validateUsername,
} from "@/lib/password";
import { getSettings } from "@/lib/settings";

export const runtime = "nodejs";

type Body = {
  username?: string;
  password?: string;
  confirmPassword?: string;
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
  const confirmPassword = body.confirmPassword ?? "";

  const usernameError = validateUsername(username);
  if (usernameError) {
    return NextResponse.json({ error: usernameError }, { status: 400 });
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ error: "两次输入的密码不一致" }, { status: 400 });
  }
  if (findUserByUsername(username)) {
    return NextResponse.json({ error: "用户名已被占用" }, { status: 409 });
  }

  let user;
  try {
    user = createUser(username, hashPassword(password));
  } catch (err) {
    if (String(err).includes("UNIQUE")) {
      return NextResponse.json({ error: "用户名已被占用" }, { status: 409 });
    }
    throw err;
  }

  const bonus = getSettings().registerBonus;
  if (bonus > 0) {
    const result = applyBalanceChange(user.id, bonus, "bonus", "注册赠送");
    user = { ...user, balance: result.balance };
  }

  const { token, expiresAt } = createSession(user.id);
  await setSessionCookie(req, token, expiresAt);

  return NextResponse.json({ user: toSessionUser(user) }, { status: 201 });
}
