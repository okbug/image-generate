import { NextResponse } from "next/server";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import {
  UPLOAD_TMP_ROUTE,
  UPLOAD_PERMANENT_ROUTE,
  getUploadTmpDir,
  getUploadPermanentDir,
  isImagebedPassword,
  resolveUploadFilePath,
  resolvePermanentFilePath,
} from "@/lib/upload-store";

export const runtime = "nodejs";

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_SIZE = 20 * 1024 * 1024;

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
    return NextResponse.json({ error: "图片不能超过 20MB" }, { status: 400 });
  }

  // 检查是否为图床模式（需要密码）
  const password = form.get("password");
  const isPermanentMode = isImagebedPassword(password);

  const ext = extFromMime(file.type);
  const fileName = `${Date.now()}-${crypto.randomUUID()}.${ext}`;

  if (isPermanentMode) {
    // 永久存储模式
    await mkdir(/*turbopackIgnore: true*/ getUploadPermanentDir(), {
      recursive: true,
    });
    const filePath = resolvePermanentFilePath(fileName);
    if (!filePath) {
      return NextResponse.json({ error: "文件名生成失败" }, { status: 500 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(/*turbopackIgnore: true*/ filePath, buffer);

    const origin = req.headers.get("origin") ?? new URL(req.url).origin;
    const url = `${origin}${UPLOAD_PERMANENT_ROUTE}/${fileName}`;

    return NextResponse.json({
      fileName,
      url,
      size: file.size,
      mime: file.type,
      permanent: true,
    });
  } else {
    // 临时存储模式（原有功能）
    if (password) {
      return NextResponse.json({ error: "密码错误" }, { status: 401 });
    }

    await mkdir(/*turbopackIgnore: true*/ getUploadTmpDir(), {
      recursive: true,
    });
    const filePath = resolveUploadFilePath(fileName);
    if (!filePath) {
      return NextResponse.json({ error: "文件名生成失败" }, { status: 500 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(/*turbopackIgnore: true*/ filePath, buffer);

    const origin = req.headers.get("origin") ?? new URL(req.url).origin;
    const url = `${origin}${UPLOAD_TMP_ROUTE}/${fileName}`;

    return NextResponse.json({
      fileName,
      url,
      size: file.size,
      mime: file.type,
      permanent: false,
    });
  }
}

export async function DELETE(req: Request) {
  const fileName = new URL(req.url).searchParams.get("name");
  const filePath = fileName ? resolveUploadFilePath(fileName) : null;
  if (!filePath) {
    return NextResponse.json({ error: "非法文件名" }, { status: 400 });
  }
  try {
    await unlink(/*turbopackIgnore: true*/ filePath);
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
