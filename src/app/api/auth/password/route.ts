import { NextResponse } from "next/server";

import {
  deleteUserSessions,
  findUserById,
  getSessionToken,
  requireUser,
  updateUserPassword,
} from "@/lib/auth";
import { hashPassword, validatePassword, verifyPassword } from "@/lib/password";

export const runtime = "nodejs";

type Body = {
  oldPassword?: string;
  newPassword?: string;
};

/** 用户自行修改密码；成功后踢掉其它设备的登录 */
export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "请求体不是合法的 JSON" }, { status: 400 });
  }

  const oldPassword = body.oldPassword ?? "";
  const newPassword = body.newPassword ?? "";
  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const row = findUserById(user.id);
  if (!row || !verifyPassword(oldPassword, row.password_hash)) {
    return NextResponse.json({ error: "原密码不正确" }, { status: 400 });
  }
  if (oldPassword === newPassword) {
    return NextResponse.json(
      { error: "新密码不能与原密码相同" },
      { status: 400 },
    );
  }

  updateUserPassword(user.id, hashPassword(newPassword));
  const currentToken = await getSessionToken();
  deleteUserSessions(user.id, currentToken ?? undefined);

  return NextResponse.json({ ok: true });
}
