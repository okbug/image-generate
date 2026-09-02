/**
 * 金额统一以「分」为整数存储/传输，只在展示层转成元。
 */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  return `${sign}¥${(Math.abs(cents) / 100).toFixed(2)}`;
}

export function yuanToCents(yuan: number): number {
  return Math.round(yuan * 100);
}

export function centsToYuan(cents: number): number {
  return Math.round(cents) / 100;
}
