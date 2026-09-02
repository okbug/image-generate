import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { SessionUser } from "@/types/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  id: number;
  username: string;
  role: "user" | "admin";
  balance: number;
  created_at: number;
  last_login_at: number | null;
};

/** GET /api/admin/users?q=关键字 */
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const db = getDb();
  const rows = (
    q
      ? db
          .prepare(
            "SELECT id, username, role, balance, created_at, last_login_at FROM users WHERE username LIKE ? ORDER BY id DESC LIMIT 500",
          )
          .all(`%${q}%`)
      : db
          .prepare(
            "SELECT id, username, role, balance, created_at, last_login_at FROM users ORDER BY id DESC LIMIT 500",
          )
          .all()
  ) as Row[];

  const users: SessionUser[] = rows.map((r) => ({
    id: r.id,
    username: r.username,
    role: r.role,
    balance: r.balance,
    createdAt: r.created_at,
    lastLoginAt: r.last_login_at,
  }));

  const totals = db
    .prepare("SELECT COUNT(*) AS count, COALESCE(SUM(balance), 0) AS balance FROM users")
    .get() as { count: number; balance: number };

  return NextResponse.json({
    users,
    total: totals.count,
    totalBalance: totals.balance,
  });
}
