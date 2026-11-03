import { NextResponse } from "next/server";

import { recordRejected, releaseAndRecord, reserveImages } from "./activation";
import {
  ACTIVATION_HEADER,
  ACTIVATION_KEY_RE,
  type ActivationCode,
  type ActivationMode,
  type UsageRecord,
} from "./activation-shared";
import {
  MISSING_CREDENTIALS_ERROR,
  resolveCredentials,
} from "./api-credentials";
import { buildUpstreamHeaders, readClientInfo } from "./client-info";
import { describeFetchError } from "./fetch-error";
import { storeGeneratedImages } from "./generated-images";
import {
  IMAGE_MODEL_OPTIONS,
  isOfficialOpenAI,
  resolveImageQuality,
} from "./models";
import type { ImagesGenerationsResponse } from "@/types/images";

/** 激活码错误时故意慢一点返回，减缓穷举。 */
const WRONG_CODE_DELAY_MS = 800;
const OFFICIAL_MAX_EDGE = 3840;
const OFFICIAL_MAX_PIXELS = 3840 * 2160;
const MAX_ERROR_LENGTH = 300;

export type ImageRequestMeta = {
  mode: ActivationMode;
  model: string;
  quality: string;
  size: string;
  n: number;
  referenceCount: number;
};

type UsageOutcome = Pick<
  UsageRecord,
  | "ok"
  | "status"
  | "images"
  | "error"
  | "inputTokens"
  | "outputTokens"
  | "totalTokens"
>;

export type ImageAccess = {
  baseUrl: string;
  apiKey: string;
  /** 请求最终发给 OpenAI 官方：不发 response_format，画质要转换。 */
  official: boolean;
  /** 只有激活码模式才有：请求结束后写使用记录并归还占用的额度。 */
  finish?: (outcome: UsageOutcome) => Promise<void>;
};

type AccessError = { error: string; status: number };

function officialBaseUrl(): string {
  return (
    process.env.OFFICIAL_IMAGE_API_BASE_URL?.trim() || "https://api.openai.com"
  );
}

function validateOfficialSize(size: string): string | null {
  if (size === "auto") return null;
  const match = /^(\d+)x(\d+)$/.exec(size);
  if (!match) return "尺寸格式不正确";
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width % 16 !== 0 || height % 16 !== 0) {
    return "官方生图要求宽和高都是 16 的倍数";
  }
  if (Math.max(width, height) > Math.min(width, height) * 3) {
    return "官方生图要求长宽比不超过 3:1";
  }
  if (
    Math.max(width, height) > OFFICIAL_MAX_EDGE ||
    width * height > OFFICIAL_MAX_PIXELS
  ) {
    return "官方生图最大支持 3840×2160";
  }
  return null;
}

function buildRecord(
  req: Request,
  code: ActivationCode,
  meta: ImageRequestMeta,
  startedAt: number,
  outcome: UsageOutcome,
): UsageRecord {
  return {
    at: new Date().toISOString(),
    key: code.key,
    user: code.user,
    mode: meta.mode,
    model: meta.model,
    quality: meta.quality,
    upstreamQuality: resolveImageQuality(meta.quality, true),
    size: meta.size,
    n: meta.n,
    referenceCount: meta.referenceCount,
    ms: Date.now() - startedAt,
    ip: readClientInfo(req).ip,
    ...outcome,
  };
}

/**
 * 决定这次图片请求用谁的凭证。
 * 无论是否使用官方生图，都必须填了用户自己的 BaseURL + Key。
 * 带了激活码就只走官方，校验失败直接报错，不回落到用户自己的 Key。
 */
export async function resolveImageAccess(
  req: Request,
  meta: ImageRequestMeta,
): Promise<ImageAccess | AccessError> {
  const creds = resolveCredentials(req);
  if (!creds) return { error: MISSING_CREDENTIALS_ERROR, status: 401 };

  const key = req.headers.get(ACTIVATION_HEADER)?.trim();
  if (!key) {
    return { ...creds, official: isOfficialOpenAI(creds.baseUrl) };
  }

  if (!ACTIVATION_KEY_RE.test(key)) {
    await new Promise((resolve) => setTimeout(resolve, WRONG_CODE_DELAY_MS));
    return { error: "激活码无效", status: 403 };
  }
  const apiKey = process.env.OFFICIAL_IMAGE_API_KEY?.trim();
  if (!apiKey) return { error: "官方生图暂未配置", status: 503 };

  if (!IMAGE_MODEL_OPTIONS.some((option) => option.value === meta.model)) {
    return { error: "官方生图不支持这个模型", status: 400 };
  }
  const sizeError = validateOfficialSize(meta.size);
  if (sizeError) return { error: sizeError, status: 400 };

  const startedAt = Date.now();
  const reserved = await reserveImages(key, meta.n);
  if (!reserved.ok) {
    if (reserved.reason === "invalid") {
      await new Promise((resolve) => setTimeout(resolve, WRONG_CODE_DELAY_MS));
      return { error: "激活码无效", status: 403 };
    }
    const status = reserved.reason === "disabled" ? 403 : 429;
    const error =
      reserved.reason === "disabled"
        ? "激活码已停用"
        : `今日额度不足（已用 ${reserved.used}/${reserved.code.dailyLimit} 张），北京时间 0 点重置`;
    await recordRejected(
      buildRecord(req, reserved.code, meta, startedAt, {
        ok: false,
        status,
        images: 0,
        error,
      }),
    );
    return { error, status };
  }

  let finished = false;
  return {
    baseUrl: officialBaseUrl(),
    apiKey,
    official: true,
    finish: async (outcome) => {
      if (finished) return;
      finished = true;
      await releaseAndRecord(
        buildRecord(req, reserved.code, meta, startedAt, outcome),
        meta.n,
      );
    },
  };
}

export function isAccessError(
  access: ImageAccess | AccessError,
): access is AccessError {
  return "error" in access;
}

function readUpstreamError(text: string): string {
  try {
    const parsed = JSON.parse(text) as { error?: { message?: unknown } };
    if (typeof parsed.error?.message === "string") {
      return parsed.error.message.slice(0, MAX_ERROR_LENGTH);
    }
  } catch {
    // 不是 JSON，用原文
  }
  return text.slice(0, MAX_ERROR_LENGTH);
}

/**
 * 转发到上游并返回响应。激活码模式下用的是站长的 Key：
 * 只有 400（参数、内容审核等用户能处理的错误）才透传详情，
 * 其余错误可能带组织 ID、Key 片段，只写进使用记录，不回给用户。
 */
export async function forwardImageRequest(
  req: Request,
  access: ImageAccess,
  path: string,
  payload: unknown,
): Promise<NextResponse> {
  const { baseUrl, apiKey, finish } = access;
  try {
    let upstream: Response;
    try {
      upstream = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
        method: "POST",
        headers: buildUpstreamHeaders(req, {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(payload),
      });
    } catch (err) {
      const detail = describeFetchError(err);
      await finish?.({ ok: false, status: 502, images: 0, error: detail });
      return NextResponse.json(
        finish
          ? { error: "暂时无法访问官方服务，请稍后再试" }
          : { error: `无法访问上游服务 (${baseUrl})`, detail },
        { status: 502 },
      );
    }

    const text = await upstream.text();
    if (!upstream.ok) {
      await finish?.({
        ok: false,
        status: upstream.status,
        images: 0,
        error: readUpstreamError(text),
      });
      if (finish && upstream.status !== 400) {
        return NextResponse.json(
          { error: `官方服务暂时不可用 (${upstream.status})，请联系管理员` },
          { status: 502 },
        );
      }
      return NextResponse.json(
        { error: `上游接口错误 (${upstream.status})`, detail: text },
        { status: upstream.status },
      );
    }

    let result: ImagesGenerationsResponse;
    try {
      result = JSON.parse(text) as ImagesGenerationsResponse;
    } catch {
      await finish?.({
        ok: false,
        status: 502,
        images: 0,
        error: "上游返回的不是合法 JSON",
      });
      return NextResponse.json(
        finish
          ? { error: "官方服务返回异常，请稍后再试" }
          : { error: "上游返回的不是合法 JSON", detail: text },
        { status: 502 },
      );
    }

    // 图片落盘为临时文件，响应里只回 URL
    const origin = req.headers.get("origin") ?? new URL(req.url).origin;
    const stored = await storeGeneratedImages(result, origin);
    await finish?.({
      ok: true,
      status: upstream.status,
      images: Array.isArray(result.data) ? result.data.length : 0,
      inputTokens: result.usage?.input_tokens,
      outputTokens: result.usage?.output_tokens,
      totalTokens: result.usage?.total_tokens,
    });
    return NextResponse.json(stored);
  } catch (err) {
    // 兜底：无论哪里抛错都要归还占用的额度
    await finish?.({
      ok: false,
      status: 500,
      images: 0,
      error: err instanceof Error ? err.message : "未知错误",
    });
    throw err;
  }
}
