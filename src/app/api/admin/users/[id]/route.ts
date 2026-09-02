import { NextResponse } from "next/server";

import {
  deleteUserSessions,
  findUserById,
  requireAdmin,
  toSessionUser,
  updateUserPassword,
  updateUserRole,
} from "@/lib/auth";
import { hashPassword, validatePassword } from "@/lib/password";

export const runtime = "nodejs";

type Body = {
  role?: "user" | "admin";
  password?: string;
};

/** PATCH /api/admin/users/:id  修改角色 / 重置密码 */
export async function PATCH(
  req: Request,
  ctx: RouteContext<"/api/admin/users/[id]">,
) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await ctx.params;
  const userId = Number.parseInt(id, 10);
  if (!Number.isInteger(userId)) {
    return NextResponse.json({ error: "非法的用户 ID" }, { status: 400 });
  }
  const target = findUserById(userId);
  if (!target) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "请求体不是合法的 JSON" }, { status: 400 });
  }

  if (body.role !== undefined) {
    if (body.role !== "user" && body.role !== "admin") {
      return NextResponse.json({ error: "非法的角色" }, { status: 400 });
    }
    if (target.id === admin.id && body.role !== "admin") {
      return NextResponse.json(
        { error: "不能取消自己的管理员身份" },
        { status: 400 },
      );
    }
    updateUserRole(target.id, body.role);
  }

  if (body.password !== undefined) {
    const passwordError = validatePassword(body.password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }
    updateUserPassword(target.id, hashPassword(body.password));
    deleteUserSessions(target.id);
  }

  const updated = findUserById(target.id);
  return NextResponse.json({ user: updated ? toSessionUser(updated) : null });
}
