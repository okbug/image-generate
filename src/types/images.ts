export type ImageOutputFormat = "png" | "webp" | "jpeg";

export type ImageItem = {
  b64_json?: string;
  url?: string;
  revised_prompt?: string;
  /** 本站把 b64_json 存成图片后补上的文件字节数（上游不返回）。 */
  bytes?: number;
  /** 存到 PicBed 图床时的 store_key，删除时用。 */
  storeKey?: string;
  /** 本站签发的删除凭证，和 storeKey 一起交给 /api/generated 才能删除。 */
  deleteToken?: string;
};

export type ImageUsageDetails = {
  text_tokens: number;
  image_tokens: number;
};

export type ImageUsage = {
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  input_tokens_details?: ImageUsageDetails;
  output_tokens_details?: ImageUsageDetails;
};

export type ImagesGenerationsResponse = {
  created: number;
  data: ImageItem[];
  background?: string;
  output_format?: ImageOutputFormat | string;
  quality?: string;
  size?: string;
  model?: string;
  usage?: ImageUsage;
};

export type GenerateRequestBody = {
  prompt: string;
  model?: string;
  size?: string;
  quality?: string;
  n?: number;
};

export type GenerateApiError = {
  error: string;
  detail?: string;
};

export type GenerateApiResult = ImagesGenerationsResponse | GenerateApiError;

export function isGenerateError(result: object): result is GenerateApiError {
  return typeof (result as GenerateApiError).error === "string";
}

/**
 * 读接口响应。本站路由出错时返回 { error, detail }；但反代超时、网关报错等情况
 * 返回的可能是 HTML / 纯文本，直接 res.json() 会抛出看不懂的 SyntaxError，
 * 这里把原文放进 detail，让前端能完整展示。
 */
export async function readApiJson<T>(
  res: Response,
): Promise<T | GenerateApiError> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return {
      error: `请求失败 (${res.status}${res.statusText ? ` ${res.statusText}` : ""})，返回的不是 JSON`,
      detail: text || undefined,
    };
  }
}

export function mimeFromFormat(format: string | undefined): string {
  switch (format) {
    case "jpeg":
    case "jpg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "png":
    default:
      return "image/png";
  }
}

export function extFromFormat(format: string | undefined): string {
  switch (format) {
    case "jpeg":
    case "jpg":
      return "jpg";
    case "webp":
      return "webp";
    case "png":
    default:
      return "png";
  }
}
