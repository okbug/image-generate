import crypto from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { ActivationInputError } from "./activation";

const COOKIE_NAME = "activation_admin";
const COOKIE_PATH = "/api/admin/activation";
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

function getPassword(): string {
  return process.env.ACTIVATION_ADMIN_PASSWORD?.trim() ?? "";
}

function safeEqual(a: string, b: string): boolean {
  const left = crypto.createHash("sha256").update(a).digest();
  const right = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(left, right);
}

export function isAdminPassword(password: unknown): boolean {
  const expected = getPassword();
  return (
    Boolean(expected) &&
    typeof password === "string" &&
    safeEqual(password, expected)
  );
}

/** 用管理密码签名过期时间：Cookie 里没有密码，换密码后旧会话自动失效。 */
function sign(expiresAt: number, password: string): string {
  return crypto
    .createHmac("sha256", password)
    .update(`activation-admin:${expiresAt}`)
    .digest("base64url");
}

export function isAdminRequest(req: NextRequest): boolean {
  const password = getPassword();
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (!password || !cookie) return false;

  const [expires, signature] = cookie.split(".");
  const expiresAt = Number(expires);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || !signature) {
    return false;
  }
  return safeEqual(signature, sign(expiresAt, password));
}

export function setAdminCookie(res: NextResponse, req: NextRequest): void {
  const expiresAt = Date.now() + SESSION_MS;
  res.cookies.set(
    COOKIE_NAME,
    `${expiresAt}.${sign(expiresAt, getPassword())}`,
    {
      httpOnly: true,
      sameSite: "strict",
      secure: req.headers.get("x-forwarded-proto") === "https",
      path: COOKIE_PATH,
      expires: new Date(expiresAt),
    },
  );
}

export function clearAdminCookie(res: NextResponse): void {
  res.cookies.set(COOKIE_NAME, "", { path: COOKIE_PATH, maxAge: 0 });
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "请先登录管理页" }, { status: 401 });
}

/** 把校验错误转成 400，其余错误（如 JSON 文件损坏）转成 500，不向外暴露细节。 */
export function adminErrorResponse(err: unknown): NextResponse {
  if (err instanceof ActivationInputError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  console.error("[activation-admin]", err);
  return NextResponse.json(
    { error: "服务器处理失败，请查看服务日志" },
    { status: 500 },
  );
}
