import path from "node:path";

export const UPLOAD_TMP_ROUTE = "/images/tmp";
export const UPLOAD_PERMANENT_ROUTE = "/images/permanent";
export const UPLOAD_NAME_RE = /^(\d{13})-[a-f0-9-]{36}\.(png|jpe?g|webp)$/i;
export const UPLOAD_EXPIRY_MS = 30 * 60 * 1000;

/**
 * 图床密码比对：密码放在环境变量 IMAGEBED_PASSWORD（.env.local，不入库），只在服务端比对。
 * 没配置时一律不通过——普通上传本来就不带密码，空对空不能算命中，否则所有上传都会变成永久图。
 */
export function isImagebedPassword(password: unknown): boolean {
  const expected = process.env.IMAGEBED_PASSWORD?.trim();
  return Boolean(expected) && password === expected;
}

export function getUploadTmpDir(): string {
  const configured = process.env.UPLOAD_TMP_DIR?.trim();
  if (configured) return path.resolve(/*turbopackIgnore: true*/ configured);

  return path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "public",
    "images",
    "tmp",
  );
}

export function getUploadPermanentDir(): string {
  const configured = process.env.UPLOAD_PERMANENT_DIR?.trim();
  if (configured) return path.resolve(/*turbopackIgnore: true*/ configured);

  return path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "public",
    "images",
    "permanent",
  );
}

export function resolveUploadFilePath(fileName: string): string | null {
  if (!UPLOAD_NAME_RE.test(fileName)) return null;
  return path.join(/*turbopackIgnore: true*/ getUploadTmpDir(), fileName);
}

export function resolvePermanentFilePath(fileName: string): string | null {
  if (!UPLOAD_NAME_RE.test(fileName)) return null;
  return path.join(/*turbopackIgnore: true*/ getUploadPermanentDir(), fileName);
}

export function getUploadMime(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}
