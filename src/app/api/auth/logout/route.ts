import { NextResponse } from "next/server";

import { logoutCurrentSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  await logoutCurrentSession(req);
  return NextResponse.json({ ok: true });
}
