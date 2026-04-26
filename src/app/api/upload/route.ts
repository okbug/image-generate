import { NextResponse } from "next/server";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export const runtime = "nodejs";

const TMP_DIR = path.join(process.cwd(), "public", "images", "tmp");
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_SIZE = 10 * 1024 * 1024;
const SAFE_NAME = /^\d{13}-[a-f0-9-]{36}\.(png|jpe?g|webp)$/i;

function extFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "png";
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "表单解析失败" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "未提供 file 字段" }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: "仅支持 PNG / JPG / WebP" },
      { status: 400 },
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "图片不能超过 10MB" },
      { status: 400 },
    );
  }

  await mkdir(TMP_DIR, { recursive: true });
  const ext = extFromMime(file.type);
  const fileName = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const filePath = path.join(TMP_DIR, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const url = `${origin}/images/tmp/${fileName}`;

  return NextResponse.json({ fileName, url, size: file.size, mime: file.type });
}

export async function DELETE(req: Request) {
  const fileName = new URL(req.url).searchParams.get("name");
  if (!fileName || !SAFE_NAME.test(fileName)) {
    return NextResponse.json({ error: "非法文件名" }, { status: 400 });
  }
  const filePath = path.join(TMP_DIR, fileName);
  try {
    await unlink(filePath);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ ok: true, missing: true });
    }
    return NextResponse.json(
      { error: "删除失败", detail: String(err) },
      { status: 500 },
    );
  }
}
