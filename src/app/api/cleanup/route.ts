import { NextResponse } from "next/server";
import { readdir, unlink } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const TMP_DIR = path.join(process.cwd(), "public", "images", "tmp");
const NAME_RE = /^(\d{13})-[a-f0-9-]{36}\.(png|jpe?g|webp)$/i;
const EXPIRY_MS = 30 * 60 * 1000;

async function sweep() {
  let entries: string[] = [];
  try {
    entries = await readdir(TMP_DIR);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { deleted: 0, scanned: 0, expiryMs: EXPIRY_MS };
    }
    throw err;
  }

  const now = Date.now();
  let deleted = 0;
  let scanned = 0;

  await Promise.all(
    entries.map(async (name) => {
      const m = name.match(NAME_RE);
      if (!m) return;
      scanned += 1;
      const ts = Number.parseInt(m[1], 10);
      if (!Number.isFinite(ts) || now - ts < EXPIRY_MS) return;
      try {
        await unlink(path.join(TMP_DIR, name));
        deleted += 1;
      } catch {
        // 文件并发被删除等情况忽略
      }
    }),
  );

  return { deleted, scanned, expiryMs: EXPIRY_MS };
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
