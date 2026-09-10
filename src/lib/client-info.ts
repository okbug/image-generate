/**
 * 把发起请求的浏览器信息（IP、UA、平台等）整理成一组请求头，随请求转发给上游，
 * 这样上游后台的日志里看到的是真实用户，而不是 Node fetch 的默认 UA。
 *
 * 所有取自请求头的值都会先清洗：只保留可见 ASCII 并限长，
 * 避免 CR/LF 注入，也避免超长头被上游直接拒掉。
 */

const APP_NAME = "AIImageStudio/1.0";
const MAX_FIELD_LEN = 256;
const MAX_UA_LEN = 512;

export type ClientInfo = {
  /** 真实访客 IP，取不到时为空串 */
  ip: string;
  /** 浏览器原始 UA */
  userAgent: string;
  /** sec-ch-ua-platform，如 macOS / Windows / Android */
  platform: string;
  /** sec-ch-ua-mobile，?0 = 桌面，?1 = 移动 */
  mobile: string;
  /** sec-ch-ua，浏览器品牌与大版本 */
  brands: string;
  language: string;
  referer: string;
  /** 访客用的域名（本站可能有多个域名） */
  host: string;
};

function sanitize(value: string | null | undefined, max = MAX_FIELD_LEN): string {
  if (!value) return "";
  return value
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/"/g, "'")
    .trim()
    .slice(0, max);
}

function isLoopback(ip: string): boolean {
  return ip === "::1" || /^(::ffff:)?127\./.test(ip);
}

/** x-forwarded-for 是 "客户端, 代理1, 代理2"；Next 自己也可能补一段本机地址，跳过回环 */
function ipChain(forwarded: string): string[] {
  return forwarded
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function readClientInfo(req: Request): ClientInfo {
  const h = req.headers;
  const chain = ipChain(sanitize(h.get("x-forwarded-for"), 200));
  const ip =
    chain.find((candidate) => !isLoopback(candidate)) ||
    sanitize(h.get("x-real-ip"), 64) ||
    sanitize(h.get("cf-connecting-ip"), 64) ||
    chain[0] ||
    "";

  return {
    ip,
    userAgent: sanitize(h.get("user-agent"), MAX_UA_LEN),
    platform: sanitize(h.get("sec-ch-ua-platform"), 64).replace(/^'|'$/g, ""),
    mobile: sanitize(h.get("sec-ch-ua-mobile"), 8),
    brands: sanitize(h.get("sec-ch-ua"), 200),
    language: sanitize(h.get("accept-language"), 64),
    referer: sanitize(h.get("referer"), 200),
    host: sanitize(h.get("host"), 128),
  };
}

/** 组一个能一眼看出访客的 UA：产品名 (来源; ip; 平台; 机型) + 浏览器原始 UA */
export function buildUserAgent(info: ClientInfo): string {
  const parts = [
    info.host ? `+https://${info.host}` : "",
    info.ip ? `ip=${info.ip}` : "",
    info.platform ? `platform=${info.platform}` : "",
    info.mobile ? `mobile=${info.mobile}` : "",
  ].filter(Boolean);

  const prefix = parts.length ? `${APP_NAME} (${parts.join("; ")})` : APP_NAME;
  const ua = info.userAgent ? `${prefix} ${info.userAgent}` : prefix;
  return ua.slice(0, MAX_UA_LEN);
}

/**
 * 在基础头（Authorization / Content-Type）之上补齐访客信息，
 * 直接交给 fetch 用。
 */
export function buildUpstreamHeaders(req: Request, base: HeadersInit): Headers {
  const info = readClientInfo(req);
  const headers = new Headers(base);

  headers.set("User-Agent", buildUserAgent(info));
  headers.set("X-Request-Id", crypto.randomUUID());

  if (info.ip) {
    headers.set("X-Forwarded-For", info.ip);
    headers.set("X-Real-IP", info.ip);
    headers.set("X-Client-IP", info.ip);
  }
  if (info.userAgent) headers.set("X-Client-User-Agent", info.userAgent);
  if (info.platform) headers.set("X-Client-Platform", info.platform);
  if (info.mobile) headers.set("X-Client-Mobile", info.mobile);
  if (info.brands) headers.set("X-Client-Brands", info.brands);
  if (info.language) headers.set("X-Client-Language", info.language);
  if (info.referer) headers.set("X-Client-Referer", info.referer);
  if (info.host) headers.set("X-Client-Host", info.host);

  return headers;
}
