import { NextResponse, type NextRequest } from "next/server";

import { beijingDate, readUsageRange } from "@/lib/activation";
import {
  adminErrorResponse,
  isAdminRequest,
  unauthorized,
} from "@/lib/activation-admin";
import type { UsageSummary } from "@/lib/activation-shared";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RANGE_DAYS = 7;
const MAX_RECORDS = 500;

/** 按北京时间日期范围查询使用记录，最多返回最近 500 条，汇总按全部匹配记录计算。 */
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();

  const params = req.nextUrl.searchParams;
  const toParam = params.get("to") ?? "";
  const fromParam = params.get("from") ?? "";
  const to = DATE_RE.test(toParam) ? toParam : beijingDate();
  const from = DATE_RE.test(fromParam)
    ? fromParam
    : beijingDate(Date.now() - (DEFAULT_RANGE_DAYS - 1) * DAY_MS);

  const user = params.get("user");
  const model = params.get("model");
  const quality = params.get("quality");
  const result = params.get("result");

  try {
    const records = (await readUsageRange(from, to)).filter(
      (record) =>
        (!user || record.user === user) &&
        (!model || record.model === model) &&
        (!quality || record.quality === quality) &&
        (!result || record.ok === (result === "ok")),
    );

    const summary = records.reduce<UsageSummary>(
      (sum, record) => ({
        calls: sum.calls + 1,
        successCalls: sum.successCalls + (record.ok ? 1 : 0),
        images: sum.images + (record.ok ? record.images : 0),
        totalTokens: sum.totalTokens + (record.totalTokens ?? 0),
      }),
      { calls: 0, successCalls: 0, images: 0, totalTokens: 0 },
    );

    return NextResponse.json({
      from,
      to,
      summary,
      records: records.slice(0, MAX_RECORDS),
      truncated: records.length > MAX_RECORDS,
    });
  } catch (err) {
    return adminErrorResponse(err);
  }
}
