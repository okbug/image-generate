import { NextResponse } from "next/server";
import { readdir, unlink } from "node:fs/promises";
import {
  UPLOAD_EXPIRY_MS,
  UPLOAD_NAME_RE,
  getUploadTmpDir,
  resolveUploadFilePath,
} from "@/lib/upload-store";

export const runtime = "nodejs";

async function sweep() {
  let entries: string[] = [];
  try {
    entries = await readdir(/*turbopackIgnore: true*/ getUploadTmpDir());
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { deleted: 0, scanned: 0, expiryMs: UPLOAD_EXPIRY_MS };
    }
    throw err;
  }

  const now = Date.now();
  let deleted = 0;
  let scanned = 0;

  await Promise.all(
    entries.map(async (name) => {
      const m = name.match(UPLOAD_NAME_RE);
      if (!m) return;
      scanned += 1;
      const ts = Number.parseInt(m[1], 10);
      if (!Number.isFinite(ts) || now - ts < UPLOAD_EXPIRY_MS) return;
      const filePath = resolveUploadFilePath(name);
      if (!filePath) return;
      try {
        await unlink(/*turbopackIgnore: true*/ filePath);
        deleted += 1;
      } catch {
        // 文件并发被删除等情况忽略
      }
    }),
  );

  return { deleted, scanned, expiryMs: UPLOAD_EXPIRY_MS };
}

export async function POST() {
  try {
    return NextResponse.json(await sweep());
  } catch (err) {
    return NextResponse.json(
      { error: "清理失败", detail: String(err) },
      { status: 500 },
    );
  }
}

export const GET = POST;
