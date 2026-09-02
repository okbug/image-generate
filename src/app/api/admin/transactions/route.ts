import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { TransactionRecord } from "@/types/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  id: number;
  user_id: number;
  username: string;
  type: string;
  amount: number;
  balance_after: number;
  note: string | null;
  operator: string | null;
  created_at: number;
};

/** GET /api/admin/transactions?userId=&q=&limit= */
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const params = new URL(req.url).searchParams;
  const userId = Number.parseInt(params.get("userId") ?? "", 10);
  const q = params.get("q")?.trim() ?? "";
  const limit = Math.min(
    Math.max(Number.parseInt(params.get("limit") ?? "100", 10) || 100, 1),
    500,
  );

  const where: string[] = [];
  const args: Array<number | string> = [];
  if (Number.isInteger(userId)) {
    where.push("t.user_id = ?");
    args.push(userId);
  }
  if (q) {
    where.push("u.username LIKE ?");
    args.push(`%${q}%`);
  }

  const rows = getDb()
    .prepare(
      `SELECT t.id, t.user_id, u.username, t.type, t.amount, t.balance_after, t.note,
              o.username AS operator, t.created_at
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN users o ON o.id = t.operator_id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY t.id DESC
       LIMIT ?`,
    )
    .all(...args, limit) as Row[];

  const transactions: TransactionRecord[] = rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    username: r.username,
    type: r.type,
    amount: r.amount,
    balanceAfter: r.balance_after,
    note: r.note,
    operator: r.operator,
    createdAt: r.created_at,
  }));

  return NextResponse.json({ transactions });
}
