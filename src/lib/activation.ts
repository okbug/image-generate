import crypto from "node:crypto";
import {
  appendFile,
  mkdir,
  readFile,
  readdir,
  rename,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import {
  type ActivationCode,
  type ActivationCodeStats,
  ACTIVATION_KEY_RE,
  type ActivationStatus,
  DEFAULT_DAILY_LIMIT,
  type UsageRecord,
} from "./activation-shared";

const MAX_USER_LENGTH = 50;
const MAX_DAILY_LIMIT = 100000;
const USAGE_FILE_RE = /^(\d{4}-\d{2}-\d{2})\.jsonl$/;
const GENERATED_KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * 同一进程里的所有路由共用一把锁和在途计数。
 * 不同路由可能各打包一份模块，所以挂在 globalThis 上。
 */
type ActivationState = {
  queue: Promise<unknown>;
  inFlight: Map<string, number>;
};

const globalStore = globalThis as typeof globalThis & {
  __activationState?: ActivationState;
};

function getState(): ActivationState {
  globalStore.__activationState ??= {
    queue: Promise.resolve(),
    inFlight: new Map(),
  };
  return globalStore.__activationState;
}

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const state = getState();
  const run = state.queue.then(task, task);
  state.queue = run.catch(() => undefined);
  return run;
}

/** standalone 下 cwd 在 .next 里，会被 build 清空，线上必须用 ACTIVATION_DATA_DIR 指到项目目录。 */
function getDataDir(): string {
  const configured = process.env.ACTIVATION_DATA_DIR?.trim();
  if (configured) return path.resolve(/*turbopackIgnore: true*/ configured);
  return path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "data",
    "activation",
  );
}

function getCodesPath(): string {
  return path.join(/*turbopackIgnore: true*/ getDataDir(), "codes.json");
}

function getUsageDir(): string {
  return path.join(/*turbopackIgnore: true*/ getDataDir(), "usage");
}

function getUsagePath(date: string): string {
  return path.join(/*turbopackIgnore: true*/ getUsageDir(), `${date}.jsonl`);
}

/** 北京时间的日期 YYYY-MM-DD。 */
export function beijingDate(at: number = Date.now()): string {
  return new Date(at + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function isMissingFile(err: unknown): boolean {
  return (err as NodeJS.ErrnoException)?.code === "ENOENT";
}

function normalizeLimit(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : DEFAULT_DAILY_LIMIT;
}

/** 文件损坏时直接抛错，不能当成空列表，否则下一次写入会把所有激活码覆盖掉。 */
async function readCodes(): Promise<ActivationCode[]> {
  let raw: string;
  try {
    raw = await readFile(/*turbopackIgnore: true*/ getCodesPath(), "utf8");
  } catch (err) {
    if (isMissingFile(err)) return [];
    throw err;
  }
  const parsed = JSON.parse(raw) as Partial<ActivationCode>[];
  return parsed
    .filter((item) => typeof item.key === "string" && item.key)
    .map((item) => ({
      key: item.key as string,
      user: typeof item.user === "string" ? item.user : "",
      disabled: item.disabled === true,
      dailyLimit: normalizeLimit(item.dailyLimit),
      createdAt:
        typeof item.createdAt === "string"
          ? item.createdAt
          : new Date(0).toISOString(),
    }));
}

/** 先写临时文件再改名，写到一半崩溃也不会弄坏原文件。 */
async function writeCodes(codes: ActivationCode[]): Promise<void> {
  const target = getCodesPath();
  const temp = `${target}.${crypto.randomUUID()}.tmp`;
  await mkdir(/*turbopackIgnore: true*/ getDataDir(), { recursive: true });
  await writeFile(
    /*turbopackIgnore: true*/ temp,
    `${JSON.stringify(codes, null, 2)}\n`,
    { mode: 0o600 },
  );
  await rename(/*turbopackIgnore: true*/ temp, target);
}

async function readUsageDay(date: string): Promise<UsageRecord[]> {
  let raw: string;
  try {
    raw = await readFile(/*turbopackIgnore: true*/ getUsagePath(date), "utf8");
  } catch (err) {
    if (isMissingFile(err)) return [];
    throw err;
  }
  const records: UsageRecord[] = [];
  for (const line of raw.split("\n")) {
    if (!line) continue;
    try {
      records.push(JSON.parse(line) as UsageRecord);
    } catch {
      // 跳过写坏的一行，不影响其余记录
    }
  }
  return records;
}

async function appendUsage(record: UsageRecord): Promise<void> {
  await mkdir(/*turbopackIgnore: true*/ getUsageDir(), { recursive: true });
  await appendFile(
    /*turbopackIgnore: true*/ getUsagePath(beijingDate(Date.parse(record.at))),
    `${JSON.stringify(record)}\n`,
    { mode: 0o600 },
  );
}

function countImages(records: UsageRecord[], key: string): number {
  return records.reduce(
    (sum, record) =>
      record.key === key && record.ok ? sum + record.images : sum,
    0,
  );
}

function isExistingKey(codes: ActivationCode[], key: string) {
  return codes.some((code) => code.key === key);
}

/** 查询激活码当前状态；不存在或已停用都返回 null。 */
export async function getActivationStatus(
  key: string,
): Promise<ActivationStatus | null> {
  const code = (await readCodes()).find((item) => item.key === key);
  if (!code || code.disabled) return null;
  const today = await readUsageDay(beijingDate());
  return {
    user: code.user,
    dailyLimit: code.dailyLimit,
    usedToday: countImages(today, key),
  };
}

export type ReserveResult =
  | { ok: true; code: ActivationCode }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "disabled"; code: ActivationCode }
  | {
      ok: false;
      reason: "limit";
      code: ActivationCode;
      used: number;
    };

/**
 * 调官方接口前先占额度：已用 + 在途 + 本次超限就拒绝，防止并发请求一起越过限额。
 * 占用成功后必须调用 releaseAndRecord 归还。
 */
export function reserveImages(key: string, n: number): Promise<ReserveResult> {
  return withLock(async () => {
    const code = (await readCodes()).find((item) => item.key === key);
    if (!code) return { ok: false, reason: "invalid" };
    if (code.disabled) return { ok: false, reason: "disabled", code };

    const { inFlight } = getState();
    const reserved = inFlight.get(key) ?? 0;
    const used = countImages(await readUsageDay(beijingDate()), key) + reserved;
    if (used + n > code.dailyLimit) {
      return { ok: false, reason: "limit", code, used };
    }
    inFlight.set(key, reserved + n);
    return { ok: true, code };
  });
}

/** 写入使用记录并归还占用。先写记录再归还，中间不会出现额度算少的窗口。 */
export function releaseAndRecord(
  record: UsageRecord,
  reserved: number,
): Promise<void> {
  return withLock(async () => {
    try {
      await appendUsage(record);
    } finally {
      const { inFlight } = getState();
      const left = (inFlight.get(record.key) ?? 0) - reserved;
      if (left > 0) inFlight.set(record.key, left);
      else inFlight.delete(record.key);
    }
  });
}

/** 记录一次被拒绝的请求（已停用 / 超限），没有占用额度。 */
export function recordRejected(record: UsageRecord): Promise<void> {
  return withLock(() => appendUsage(record));
}

export class ActivationInputError extends Error {}

function validateUser(user: unknown): string {
  const value = typeof user === "string" ? user.trim() : "";
  if (!value || value.length > MAX_USER_LENGTH) {
    throw new ActivationInputError(
      `使用人不能为空，且不超过 ${MAX_USER_LENGTH} 个字符`,
    );
  }
  return value;
}

function validateLimit(limit: unknown): number {
  if (
    typeof limit !== "number" ||
    !Number.isInteger(limit) ||
    limit < 0 ||
    limit > MAX_DAILY_LIMIT
  ) {
    throw new ActivationInputError(
      `每日限额必须是 0~${MAX_DAILY_LIMIT} 的整数`,
    );
  }
  return limit;
}

function generateKey(): string {
  const bytes = crypto.randomBytes(16);
  const chars = Array.from(
    bytes,
    (byte) => GENERATED_KEY_ALPHABET[byte % GENERATED_KEY_ALPHABET.length],
  ).join("");
  return chars.match(/.{4}/g)?.join("-") ?? chars;
}

export function createCode(input: {
  key?: unknown;
  user?: unknown;
  dailyLimit?: unknown;
}): Promise<ActivationCode> {
  return withLock(async () => {
    const user = validateUser(input.user);
    const dailyLimit =
      input.dailyLimit === undefined
        ? DEFAULT_DAILY_LIMIT
        : validateLimit(input.dailyLimit);
    const codes = await readCodes();

    const requested = typeof input.key === "string" ? input.key.trim() : "";
    if (requested && !ACTIVATION_KEY_RE.test(requested)) {
      throw new ActivationInputError(
        "激活码需为 4~64 位英文、数字或符号，不能有空格和中文",
      );
    }
    let key = requested;
    while (!key || (!requested && isExistingKey(codes, key))) {
      key = generateKey();
    }
    if (isExistingKey(codes, key)) {
      throw new ActivationInputError("这个激活码已存在");
    }

    const code: ActivationCode = {
      key,
      user,
      disabled: false,
      dailyLimit,
      createdAt: new Date().toISOString(),
    };
    await writeCodes([...codes, code]);
    return code;
  });
}

export function updateCode(
  key: unknown,
  patch: { user?: unknown; disabled?: unknown; dailyLimit?: unknown },
): Promise<ActivationCode> {
  return withLock(async () => {
    const codes = await readCodes();
    const index = codes.findIndex((code) => code.key === key);
    if (index < 0) throw new ActivationInputError("激活码不存在");

    const next = { ...codes[index] };
    if (patch.user !== undefined) next.user = validateUser(patch.user);
    if (patch.dailyLimit !== undefined) {
      next.dailyLimit = validateLimit(patch.dailyLimit);
    }
    if (patch.disabled !== undefined) next.disabled = patch.disabled === true;

    codes[index] = next;
    await writeCodes(codes);
    return next;
  });
}

/** 只删激活码，历史使用记录保留。 */
export function deleteCode(key: unknown): Promise<void> {
  return withLock(async () => {
    const codes = await readCodes();
    const rest = codes.filter((code) => code.key !== key);
    if (rest.length === codes.length) {
      throw new ActivationInputError("激活码不存在");
    }
    await writeCodes(rest);
  });
}

async function listUsageDates(): Promise<string[]> {
  try {
    const names = await readdir(/*turbopackIgnore: true*/ getUsageDir());
    return names
      .map((name) => USAGE_FILE_RE.exec(name)?.[1])
      .filter((date): date is string => Boolean(date))
      .sort();
  } catch (err) {
    if (isMissingFile(err)) return [];
    throw err;
  }
}

/** 按日期范围（含首尾，北京时间）读取使用记录，新的在前。 */
export async function readUsageRange(
  from: string,
  to: string,
): Promise<UsageRecord[]> {
  const dates = (await listUsageDates()).filter(
    (date) => date >= from && date <= to,
  );
  const days = await Promise.all(dates.map(readUsageDay));
  return days.flat().sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export async function listCodesWithStats(): Promise<ActivationCodeStats[]> {
  const [codes, dates] = await Promise.all([readCodes(), listUsageDates()]);
  const days = await Promise.all(dates.map(readUsageDay));
  const today = beijingDate();

  const stats = new Map<
    string,
    Pick<
      ActivationCodeStats,
      "usedToday" | "totalImages" | "totalCalls" | "lastUsedAt"
    >
  >();
  days.forEach((records, index) => {
    for (const record of records) {
      const current = stats.get(record.key) ?? {
        usedToday: 0,
        totalImages: 0,
        totalCalls: 0,
        lastUsedAt: null,
      };
      current.totalCalls += 1;
      if (record.ok) {
        current.totalImages += record.images;
        if (dates[index] === today) current.usedToday += record.images;
      }
      if (!current.lastUsedAt || record.at > current.lastUsedAt) {
        current.lastUsedAt = record.at;
      }
      stats.set(record.key, current);
    }
  });

  return codes.map((code) => ({
    ...code,
    ...(stats.get(code.key) ?? {
      usedToday: 0,
      totalImages: 0,
      totalCalls: 0,
      lastUsedAt: null,
    }),
  }));
}
