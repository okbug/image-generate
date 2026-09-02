import { withTransaction } from "./db";

export type TxType =
  | "generate"
  | "edit"
  | "optimize"
  | "refund"
  | "topup"
  | "adjust"
  | "bonus";

export class InsufficientBalanceError extends Error {
  constructor(
    public readonly required: number,
    public readonly balance: number,
  ) {
    super("余额不足");
    this.name = "InsufficientBalanceError";
  }
}

export type BalanceChange = { balance: number; txId: number };

/**
 * 对用户余额施加变动并写流水。delta 为正入账、为负扣费（单位：分）。
 * 余额不允许为负：扣费不足抛 InsufficientBalanceError。
 */
export function applyBalanceChange(
  userId: number,
  delta: number,
  type: TxType,
  note?: string,
  operatorId?: number,
): BalanceChange {
  if (!Number.isInteger(delta)) {
    throw new Error("金额必须是整数（分）");
  }
  return withTransaction((db) => {
    const row = db
      .prepare("SELECT balance FROM users WHERE id = ?")
      .get(userId) as { balance: number } | undefined;
    if (!row) throw new Error("用户不存在");

    const next = row.balance + delta;
    if (next < 0) throw new InsufficientBalanceError(-delta, row.balance);

    db.prepare("UPDATE users SET balance = ? WHERE id = ?").run(next, userId);
    const result = db
      .prepare(
        "INSERT INTO transactions (user_id, type, amount, balance_after, note, operator_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        userId,
        type,
        delta,
        next,
        note ?? null,
        operatorId ?? null,
        Date.now(),
      );
    return { balance: next, txId: Number(result.lastInsertRowid) };
  });
}

/** 扣费；amount <= 0 时不产生流水，直接返回当前余额 */
export function charge(
  userId: number,
  amount: number,
  type: Extract<TxType, "generate" | "edit" | "optimize">,
  note?: string,
): BalanceChange {
  if (amount <= 0) {
    return applyBalanceChange(userId, 0, type, note);
  }
  return applyBalanceChange(userId, -amount, type, note);
}

/** 上游失败时把已扣的钱退回 */
export function refund(userId: number, amount: number, note?: string): BalanceChange | null {
  if (amount <= 0) return null;
  return applyBalanceChange(userId, amount, "refund", note);
}
