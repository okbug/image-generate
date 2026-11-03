import { NextResponse, type NextRequest } from "next/server";

import {
  createCode,
  deleteCode,
  listCodesWithStats,
  updateCode,
} from "@/lib/activation";
import {
  adminErrorResponse,
  isAdminRequest,
  unauthorized,
} from "@/lib/activation-admin";

export const runtime = "nodejs";

type CodeBody = {
  key?: unknown;
  user?: unknown;
  disabled?: unknown;
  dailyLimit?: unknown;
};

async function readBody(req: NextRequest): Promise<CodeBody | null> {
  try {
    return (await req.json()) as CodeBody;
  } catch {
    return null;
  }
}

function invalidBody() {
  return NextResponse.json({ error: "请求体不是合法的 JSON" }, { status: 400 });
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();
  try {
    return NextResponse.json({ codes: await listCodesWithStats() });
  } catch (err) {
    return adminErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();
  const body = await readBody(req);
  if (!body) return invalidBody();
  try {
    return NextResponse.json({ code: await createCode(body) });
  } catch (err) {
    return adminErrorResponse(err);
  }
}

export async function PATCH(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();
  const body = await readBody(req);
  if (!body) return invalidBody();
  try {
    const { key, ...patch } = body;
    return NextResponse.json({ code: await updateCode(key, patch) });
  } catch (err) {
    return adminErrorResponse(err);
  }
}

export async function DELETE(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();
  const body = await readBody(req);
  if (!body) return invalidBody();
  try {
    await deleteCode(body.key);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return adminErrorResponse(err);
  }
}
