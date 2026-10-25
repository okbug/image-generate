import crypto from "node:crypto";

/**
 * PicBed 图床（出图结果的长期存储）。BaseURL / Token 在 .env.local，只在服务端使用。
 * 文档：{PICBED_BASE_URL}/api/doc。store_key 形如 `20261025-164314_gen-<uuid>.png`。
 */

const UPLOAD_TIMEOUT_MS = 120_000;
const DELETE_TIMEOUT_MS = 30_000;

/** store_key 只允许时间戳 + 本站生成的 gen-<uuid> 文件名，防止借删除接口删图床里别的图。 */
export const PICBED_GEN_KEY_RE =
  /^\d{8}-\d{6}_gen-[a-f0-9-]{36}(?:-\d+)?\.(png|jpg|webp)$/;

function getConfig(): { baseUrl: string; token: string } | null {
  const baseUrl = process.env.PICBED_BASE_URL?.trim().replace(/\/$/, "");
  const token = process.env.PICBED_TOKEN?.trim();
  if (!baseUrl || !token) return null;
  return { baseUrl, token };
}

export function isPicbedConfigured(): boolean {
  return getConfig() !== null;
}

/** 上传一张图，返回图床公网 URL 与 store_key；失败抛错，由调用方回退。 */
export async function uploadToPicbed(
  buffer: Buffer,
  fileName: string,
): Promise<{ url: string; storeKey: string }> {
  const config = getConfig();
  if (!config) throw new Error("PicBed 未配置");

  const res = await fetch(`${config.baseUrl}/api/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filename: fileName,
      content_base64: buffer.toString("base64"),
    }),
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
  });
  const json = (await res.json()) as {
    ok?: boolean;
    store_key?: string;
    path?: string;
    error?: string;
  };
  if (!res.ok || !json.ok || !json.store_key || !json.path) {
    throw new Error(json.error ?? `PicBed 上传失败 (${res.status})`);
  }
  // url 字段按 Host 头生成，用 path 自己拼公网地址更稳
  return { url: `${config.baseUrl}${json.path}`, storeKey: json.store_key };
}

/** 删除一张图；图床上已经不存在（404）也算成功。 */
export async function deleteFromPicbed(storeKey: string): Promise<void> {
  const config = getConfig();
  if (!config) throw new Error("PicBed 未配置");

  const res = await fetch(
    `${config.baseUrl}/api/images/${encodeURIComponent(storeKey)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${config.token}` },
      signal: AbortSignal.timeout(DELETE_TIMEOUT_MS),
    },
  );
  if (!res.ok && res.status !== 404) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? `PicBed 删除失败 (${res.status})`);
  }
}

/**
 * 删除凭证：出图时随 store_key 一起发给前端，删除时必须带回来。
 * 用 Token 做 HMAC 密钥，前端拿不到 Token 也就伪造不了别的 key 的凭证。
 */
export function signDeleteToken(storeKey: string): string {
  const config = getConfig();
  if (!config) return "";
  return crypto
    .createHmac("sha256", config.token)
    .update(`delete:${storeKey}`)
    .digest("hex");
}

export function verifyDeleteToken(storeKey: string, token: unknown): boolean {
  if (typeof token !== "string" || token.length === 0) return false;
  const expected = signDeleteToken(storeKey);
  if (!expected || expected.length !== token.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}
