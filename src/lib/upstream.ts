import { NextResponse } from "next/server";

import type { BillingInfo, SessionUser } from "@/types/auth";

import type { ApiCredentials } from "./api-credentials";
import { charge, InsufficientBalanceError, refund } from "./billing";
import { formatCents } from "./money";

export type UpstreamFailure = {
  ok: false;
  status: number;
  error: string;
  detail?: string;
};
export type UpstreamResult = { ok: true; data: unknown } | UpstreamFailure;

/** 调用 OpenAI 兼容上游并把响应解析成 JSON */
export async function callUpstream(
  creds: ApiCredentials,
  pathname: string,
  payload: unknown,
): Promise<UpstreamResult> {
  let upstream: Response;
  try {
    upstream = await fetch(`${creds.baseUrl.replace(/\/$/, "")}${pathname}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return {
      ok: false,
      status: 502,
      error: `无法访问上游服务 (${creds.baseUrl})`,
      detail: String(err),
    };
  }

  const text = await upstream.text();
  if (!upstream.ok) {
    return {
      ok: false,
      status: upstream.status,
      error: `上游接口错误 (${upstream.status})`,
      detail: text,
    };
  }
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "上游返回的不是合法 JSON",
      detail: text,
    };
  }
}

type BilledCallArgs = {
  user: SessionUser;
  /** 本次应扣金额（分），0 表示免费 */
  cost: number;
  type: "generate" | "edit" | "optimize";
  note: string;
  creds: ApiCredentials;
  pathname: string;
  payload: unknown;
  /**
   * 成功时把上游 JSON 变成要返回给前端的对象；返回 UpstreamFailure 表示
   * 虽然 HTTP 成功但内容无效，需要退款。
   */
  mapSuccess?: (data: unknown) => Record<string, unknown> | UpstreamFailure;
};

/**
 * 先扣费再调上游；上游失败自动退款。响应里统一附带 billing 字段。
 */
export async function billedUpstreamCall(
  args: BilledCallArgs,
): Promise<NextResponse> {
  const { user, cost, type, note, creds, pathname, payload } = args;

  let charged = 0;
  let balance = user.balance;
  if (cost > 0) {
    try {
      const result = charge(user.id, cost, type, note);
      charged = cost;
      balance = result.balance;
    } catch (err) {
      if (err instanceof InsufficientBalanceError) {
        return NextResponse.json(
          {
            error: `余额不足：本次需要 ${formatCents(err.required)}，当前余额 ${formatCents(err.balance)}`,
            code: "INSUFFICIENT_BALANCE",
            required: err.required,
            balance: err.balance,
          },
          { status: 402 },
        );
      }
      throw err;
    }
  }

  const fail = (failure: UpstreamFailure) => {
    if (charged > 0) {
      try {
        const refunded = refund(user.id, charged, `${note} · 失败退款`);
        if (refunded) balance = refunded.balance;
      } catch (err) {
        console.error("[billing] 退款失败", err);
      }
    }
    const billing: BillingInfo = { charged: 0, balance };
    return NextResponse.json(
      { error: failure.error, detail: failure.detail, billing },
      { status: failure.status },
    );
  };

  const result = await callUpstream(creds, pathname, payload);
  if (!result.ok) return fail(result);

  let body: Record<string, unknown>;
  if (args.mapSuccess) {
    const mapped = args.mapSuccess(result.data);
    if ("ok" in mapped && mapped.ok === false) return fail(mapped as UpstreamFailure);
    body = mapped as Record<string, unknown>;
  } else {
    body =
      result.data && typeof result.data === "object"
        ? (result.data as Record<string, unknown>)
        : { data: result.data };
  }

  const billing: BillingInfo = { charged, balance };
  return NextResponse.json({ ...body, billing });
}
