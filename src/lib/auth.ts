import { randomBytes } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import type { SessionUser } from "@/types/auth";

import { getDb, type Role, type UserRow } from "./db";

export const SESSION_COOKIE = "ig_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const USER_COLUMNS =
  "id, username, password_hash, role, balance, created_at, last_login_at";

export function toSessionUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    balance: row.balance,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

export function findUserByUsername(username: string): UserRow | undefined {
  return getDb()
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE username = ?`)
    .get(username) as UserRow | undefined;
}

export function findUserById(id: number): UserRow | undefined {
  return getDb()
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`)
    .get(id) as UserRow | undefined;
}

export function createUser(
  username: string,
  passwordHash: string,
  role: Role = "user",
): UserRow {
  const result = getDb()
    .prepare(
      "INSERT INTO users (username, password_hash, role, balance, created_at) VALUES (?, ?, ?, 0, ?)",
    )
    .run(username, passwordHash, role, Date.now());
  const user = findUserById(Number(result.lastInsertRowid));
  if (!user) throw new Error("创建用户失败");
  return user;
}

export function updateUserPassword(userId: number, passwordHash: string) {
  getDb()
    .prepare("UPDATE users SET password_hash = ? WHERE id = ?")
    .run(passwordHash, userId);
}

export function updateUserRole(userId: number, role: Role) {
  getDb().prepare("UPDATE users SET role = ? WHERE id = ?").run(role, userId);
}

// ---------- 会话 ----------

export function createSession(userId: number): {
  token: string;
  expiresAt: number;
} {
  const db = getDb();
  const now = Date.now();
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now);

  const token = randomBytes(32).toString("base64url");
  const expiresAt = now + SESSION_TTL_MS;
  db.prepare(
    "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
  ).run(token, userId, now, expiresAt);
  db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(now, userId);
  return { token, expiresAt };
}

export function deleteSession(token: string) {
  getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

/** 撤销某用户的全部会话；exceptToken 用于保留当前登录 */
export function deleteUserSessions(userId: number, exceptToken?: string) {
  if (exceptToken) {
    getDb()
      .prepare("DELETE FROM sessions WHERE user_id = ? AND token != ?")
      .run(userId, exceptToken);
  } else {
    getDb().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  }
}

export function getUserBySessionToken(token: string): SessionUser | null {
  const row = getDb()
    .prepare(
      `SELECT u.id, u.username, u.role, u.balance, u.created_at, u.last_login_at, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`,
    )
    .get(token) as
    | {
        id: number;
        username: string;
        role: Role;
        balance: number;
        created_at: number;
        last_login_at: number | null;
        expires_at: number;
      }
    | undefined;
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    deleteSession(token);
    return null;
  }
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    balance: row.balance,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = await getSessionToken();
  if (!token) return null;
  return getUserBySessionToken(token);
}

/** 经 Caddy 反代时以 X-Forwarded-Proto 判断，直连时看请求协议 */
export function isSecureRequest(req: Request): boolean {
  const forwarded = req.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0].trim() === "https";
  return new URL(req.url).protocol === "https:";
}

export async function setSessionCookie(
  req: Request,
  token: string,
  expiresAt: number,
) {
  const store = await cookies();
  store.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(req),
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function clearSessionCookie(req: Request) {
  const store = await cookies();
  store.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(req),
    path: "/",
    maxAge: 0,
  });
}

export async function logoutCurrentSession(req: Request) {
  const token = await getSessionToken();
  if (token) deleteSession(token);
  await clearSessionCookie(req);
}

// ---------- 路由守卫 ----------

export function unauthorized(message = "请先登录") {
  return NextResponse.json(
    { error: message, code: "UNAUTHORIZED" },
    { status: 401 },
  );
}

export function forbidden(message = "没有权限") {
  return NextResponse.json({ error: message, code: "FORBIDDEN" }, { status: 403 });
}

/** 返回当前用户，未登录时返回 401 响应 */
export async function requireUser(): Promise<SessionUser | NextResponse> {
  const user = await getCurrentUser();
  return user ?? unauthorized();
}

/** 返回当前管理员，未登录 401 / 非管理员 403 */
export async function requireAdmin(): Promise<SessionUser | NextResponse> {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden("需要管理员权限");
  return user;
}
