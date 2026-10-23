import { NextResponse } from "next/server";
import { readdir, stat } from "node:fs/promises";

import {
  IMAGEBED_PASSWORD,
  UPLOAD_EXPIRY_MS,
  UPLOAD_NAME_RE,
  UPLOAD_TMP_ROUTE,
  getUploadTmpDir,
  resolveUploadFilePath,
} from "@/lib/upload-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type TmpImageInfo = {
  fileName: string;
  url: string;
  size: number;
  uploadedAt: number;
  expiresAt: number;
};

/** 密码错误时故意慢一点返回，减缓穷举。 */
const WRONG_PASSWORD_DELAY_MS = 800;

/**
 * 列出临时目录里的图片（按上传时间降序）。
 * 密码只在服务端比对，前端代码里不出现密码。
 */
export async function POST(req: Request) {
  let password = "";
  try {
    const body = (await req.json()) as { password?: unknown };
    if (typeof body.password === "string") password = body.password;
  } catch {
    return NextResponse.json(
      { error: "请求体不是合法的 JSON" },
      { status: 400 },
    );
  }

  if (password !== IMAGEBED_PASSWORD) {
    await new Promise((resolve) =>
      setTimeout(resolve, WRONG_PASSWORD_DELAY_MS),
    );
    return NextResponse.json({ error: "密码错误" }, { status: 401 });
  }

  let entries: string[] = [];
  try {
    entries = await readdir(/*turbopackIgnore: true*/ getUploadTmpDir());
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      return NextResponse.json(
        { error: "读取临时目录失败", detail: String(err) },
        { status: 500 },
      );
    }
  }

  const images = await Promise.all(
    entries.map(async (name): Promise<TmpImageInfo | null> => {
      const m = name.match(UPLOAD_NAME_RE);
      const filePath = resolveUploadFilePath(name);
      if (!m || !filePath) return null;
      try {
        const fileStat = await stat(/*turbopackIgnore: true*/ filePath);
        if (!fileStat.isFile()) return null;
        const uploadedAt = Number.parseInt(m[1], 10);
        return {
          fileName: name,
          url: `${UPLOAD_TMP_ROUTE}/${name}`,
          size: fileStat.size,
          uploadedAt,
          expiresAt: uploadedAt + UPLOAD_EXPIRY_MS,
        };
      } catch {
        // 列目录和 stat 之间被清理掉了，跳过
        return null;
      }
    }),
  );

  const list = images
    .filter((item): item is TmpImageInfo => item !== null)
    .sort((a, b) => b.uploadedAt - a.uploadedAt);

  return NextResponse.json({ images: list });
}
