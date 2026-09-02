export type Role = "user" | "admin";

/** 前后端共用的用户视图（不含密码等敏感字段） */
export type SessionUser = {
  id: number;
  username: string;
  role: Role;
  /** 余额，单位：分 */
  balance: number;
  createdAt: number;
  lastLoginAt: number | null;
};

export type PublicPrices = {
  generate: number;
  edit: number;
  optimize: number;
};

export type MeResponse = {
  user: SessionUser | null;
  prices: PublicPrices;
};

export type BillingInfo = {
  /** 本次实际扣费（分），使用自定义 API 时为 0 */
  charged: number;
  /** 扣费后的余额（分） */
  balance: number;
};
