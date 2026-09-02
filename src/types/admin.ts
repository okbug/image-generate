import type { SessionUser } from "./auth";

export type TransactionRecord = {
  id: number;
  userId: number;
  username: string;
  type: string;
  amount: number;
  balanceAfter: number;
  note: string | null;
  operator: string | null;
  createdAt: number;
};

export type SettingsView = {
  priceGenerate: number;
  priceEdit: number;
  priceOptimize: number;
  registerBonus: number;
  apiBaseUrl: string;
  apiKeySet: boolean;
  apiKeyMasked: string;
};

export type EnvFallbackView = {
  apiBaseUrl: string;
  apiKeySet: boolean;
  apiKeyMasked: string;
};

export type AdminSettingsResponse = {
  settings: SettingsView;
  env: EnvFallbackView;
};

export type AdminUsersResponse = {
  users: SessionUser[];
  total: number;
  totalBalance: number;
};

export type TransactionsResponse = {
  transactions: TransactionRecord[];
};
