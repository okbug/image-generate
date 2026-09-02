import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getSettings, toPublicPrices } from "@/lib/settings";
import type { MeResponse } from "@/types/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  const body: MeResponse = {
    user,
    prices: toPublicPrices(getSettings()),
  };
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}
