import { NextResponse } from "next/server";

import { findUserById, requireAdmin, toSessionUser } from "@/lib/auth";
import { applyBalanceChange, InsufficientBalanceError } from "@/lib/billing";
import { formatCents } from "@/lib/money";

export const runtime = "nodejs";

type Body = {
  /** 变动金额（分），正数充值、负数扣减 */
  amount?: number;
  note?: string;
};

/** POST /api/admin/users/:id/balance  给用户加/减余额 */
export async function POST(
  req: Request,
  ctx: RouteContext<"/api/admin/users/[id]/balance">,
) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await ctx.params;
  const userId = Number.parseInt(id, 10);
  if (!Number.isInteger(userId)) {
    return NextResponse.json({ error: "非法的用户 ID" }, { status: 400 });
  }
  if (!findUserById(userId)) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "请求体不是合法的 JSON" }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!Number.isInteger(amount) || amount === 0) {
    return NextResponse.json(
      { error: "金额必须是非零整数（单位：分）" },
      { status: 400 },
    );
  }
  if (Math.abs(amount) > 100_000_000) {
    return NextResponse.json({ error: "单次金额过大" }, { status: 400 });
  }
  const note = body.note?.trim() || (amount > 0 ? "管理员充值" : "管理员扣减");

  try {
    const result = applyBalanceChange(
      userId,
      amount,
      amount > 0 ? "topup" : "adjust",
      `${note}（操作人：${admin.username}）`,
      admin.id,
    );
    const user = findUserById(userId);
    return NextResponse.json({
      user: user ? toSessionUser(user) : null,
      balance: result.balance,
      txId: result.txId,
    });
  } catch (err) {
    if (err instanceof InsufficientBalanceError) {
      return NextResponse.json(
        {
          error: `扣减后余额会为负：当前余额 ${formatCents(err.balance)}`,
        },
        { status: 400 },
      );
    }
    throw err;
  }
}
