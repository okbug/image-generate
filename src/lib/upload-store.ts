import path from "node:path";

export const UPLOAD_TMP_ROUTE = "/images/tmp";
export const UPLOAD_PERMANENT_ROUTE = "/images/permanent";
export const UPLOAD_NAME_RE =
  /^(\d{13})-[a-f0-9-]{36}\.(png|jpe?g|webp)$/i;
export const UPLOAD_EXPIRY_MS = 30 * 60 * 1000;
export const IMAGEBED_PASSWORD = process.env.IMAGEBED_PASSWORD ?? "";

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
  return path.join(getUploadTmpDir(), fileName);
}

export function resolvePermanentFilePath(fileName: string): string | null {
  if (!UPLOAD_NAME_RE.test(fileName)) return null;
  return path.join(getUploadPermanentDir(), fileName);
}

export function getUploadMime(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}
