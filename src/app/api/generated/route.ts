import { NextResponse } from "next/server";

import {
  PICBED_GEN_KEY_RE,
  deleteFromPicbed,
  verifyDeleteToken,
} from "@/lib/picbed";

export const runtime = "nodejs";

/**
 * 删除「最近生成」里的一张图：从 PicBed 图床删掉。
 * 必须带出图时签发的 deleteToken，且 storeKey 只能是本站生成的 gen- 文件，
 * 不能借这个接口删图床里别的图。
 */
export async function DELETE(req: Request) {
  let body: { storeKey?: unknown; deleteToken?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "请求体不是合法的 JSON" },
      { status: 400 },
    );
  }

  const storeKey = typeof body.storeKey === "string" ? body.storeKey : "";
  if (
    !PICBED_GEN_KEY_RE.test(storeKey) ||
    !verifyDeleteToken(storeKey, body.deleteToken)
  ) {
    return NextResponse.json({ error: "无权删除这张图片" }, { status: 403 });
  }

  try {
    await deleteFromPicbed(storeKey);
  } catch (err) {
    return NextResponse.json(
      { error: "图床删除失败", detail: String(err) },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
