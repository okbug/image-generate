import { getSettings } from "./settings";

/**
 * 解析每次请求要使用的上游 API 凭证。
 * 优先级：请求头（用户在浏览器里配置的自定义凭证）→ 后台设置 → 环境变量。
 * 后端不持久化用户填的凭证，只是临时使用并转发到上游。
 *
 * source 用于计费：用户自带凭证（custom）时不扣余额。
 */
export type CredentialSource = "custom" | "settings" | "env";

export type ApiCredentials = {
  baseUrl: string;
  apiKey: string;
  source: CredentialSource;
};

export function resolveCredentials(req: Request): ApiCredentials | null {
  const headerBaseUrl = req.headers.get("x-image-api-base-url")?.trim();
  const headerApiKey = req.headers.get("x-image-api-key")?.trim();
  if (headerBaseUrl && headerApiKey) {
    return { baseUrl: headerBaseUrl, apiKey: headerApiKey, source: "custom" };
  }

  const settings = getSettings();
  if (settings.apiBaseUrl && settings.apiKey) {
    return {
      baseUrl: settings.apiBaseUrl,
      apiKey: settings.apiKey,
      source: "settings",
    };
  }

  const envBaseUrl = process.env.IMAGE_API_BASE_URL?.trim();
  const envApiKey = process.env.IMAGE_API_KEY?.trim();
  if (envBaseUrl && envApiKey) {
    return { baseUrl: envBaseUrl, apiKey: envApiKey, source: "env" };
  }

  return null;
}

export const MISSING_CREDENTIALS_MESSAGE =
  "未配置生图 API：请管理员在后台「设置」中填写 BaseURL 与 API Key，或在页面右上角使用自定义凭证";
