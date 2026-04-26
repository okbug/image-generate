/**
 * 解析每次请求要使用的上游 API 凭证。
 * 优先级：请求头（用户在浏览器里配置的覆盖值）→ 环境变量。
 * 这样后端不持久化任何用户填的凭证，只是临时使用并转发到上游。
 */
export type ApiCredentials = {
  baseUrl: string;
  apiKey: string;
};

export function resolveCredentials(req: Request): ApiCredentials | null {
  const headerBaseUrl = req.headers.get("x-image-api-base-url")?.trim();
  const headerApiKey = req.headers.get("x-image-api-key")?.trim();

  const baseUrl = headerBaseUrl || process.env.IMAGE_API_BASE_URL;
  const apiKey = headerApiKey || process.env.IMAGE_API_KEY;

  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}
