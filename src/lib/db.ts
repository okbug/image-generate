import { mkdirSync } from "node:fs";
import path from "node:path";

import { hashPassword } from "./password";

/**
 * 使用 Node 22.13+ 内置的 node:sqlite，通过 process.getBuiltinModule 加载，
 * 绕开打包器解析（不需要任何原生依赖）。
 */
type SQLInput = null | number | bigint | string | Uint8Array;

export interface StatementSync {
  run(...params: SQLInput[]): {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  };
  get(...params: SQLInput[]): Record<string, unknown> | undefined;
  all(...params: SQLInput[]): Record<string, unknown>[];
}

export interface DatabaseSyncInstance {
  prepare(sql: string): StatementSync;
  exec(sql: string): void;
  close(): void;
}

interface DatabaseSyncCtor {
  new (filename: string): DatabaseSyncInstance;
}

function loadDatabaseSync(): DatabaseSyncCtor {
  const getBuiltinModule = (
    process as unknown as {
      getBuiltinModule?: (id: string) => unknown;
    }
  ).getBuiltinModule;
  if (typeof getBuiltinModule !== "function") {
    throw new Error("需要 Node.js 22.13 及以上版本（依赖内置 node:sqlite）");
  }
  const mod = getBuiltinModule("node:sqlite") as
    | { DatabaseSync?: DatabaseSyncCtor }
    | undefined;
  if (!mod?.DatabaseSync) {
    throw new Error("当前 Node.js 不支持 node:sqlite，请升级到 22.13 及以上");
  }
  return mod.DatabaseSync;
}

export function getDataDir(): string {
  const configured = process.env.DATA_DIR?.trim();
  if (configured) return path.resolve(/*turbopackIgnore: true*/ configured);
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "data");
}

export type Role = "user" | "admin";

export type UserRow = {
  id: number;
  username: string;
  password_hash: string;
  role: Role;
  balance: number;
  created_at: number;
  last_login_at: number | null;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  balance INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  note TEXT,
  operator_id INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id, id DESC);
`;

/** 设置项默认值（金额单位：分） */
export const DEFAULT_SETTINGS: Record<string, string> = {
  price_generate: "100",
  price_edit: "100",
  price_optimize: "0",
  register_bonus: "0",
  api_base_url: "",
  api_key: "",
};

function seed(db: DatabaseSyncInstance) {
  const now = Date.now();
  const insertSetting = db.prepare(
    "INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)",
  );
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    insertSetting.run(key, value, now);
  }

  const hasAdmin = db
    .prepare("SELECT 1 AS ok FROM users WHERE role = 'admin' LIMIT 1")
    .get();
  if (!hasAdmin) {
    const username = process.env.ADMIN_INITIAL_USERNAME?.trim() || "admin";
    const password = process.env.ADMIN_INITIAL_PASSWORD?.trim() || "admin123";
    const result = db
      .prepare(
        "INSERT OR IGNORE INTO users (username, password_hash, role, balance, created_at) VALUES (?, ?, 'admin', 0, ?)",
      )
      .run(username, hashPassword(password), now);
    if (Number(result.changes) === 0) {
      // 用户名已被普通用户占用：直接提升为管理员，保证系统至少有一个管理员
      db.prepare("UPDATE users SET role = 'admin' WHERE username = ?").run(
        username,
      );
    }
    console.warn(
      `[db] 已初始化管理员账号「${username}」，请尽快登录后台修改密码。`,
    );
  }
}

const globalRef = globalThis as unknown as {
  __imageGenerateDb?: DatabaseSyncInstance;
};

export function getDb(): DatabaseSyncInstance {
  if (globalRef.__imageGenerateDb) return globalRef.__imageGenerateDb;

  const DatabaseSync = loadDatabaseSync();
  const dir = getDataDir();
  mkdirSync(/*turbopackIgnore: true*/ dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "app.db"));
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec(SCHEMA);
  seed(db);

  globalRef.__imageGenerateDb = db;
  return db;
}

/** 在一个 IMMEDIATE 事务里执行 fn，异常自动回滚 */
export function withTransaction<T>(fn: (db: DatabaseSyncInstance) => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn(db);
    db.exec("COMMIT");
    return result;
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // 已经回滚/连接异常时忽略
    }
    throw err;
  }
}
