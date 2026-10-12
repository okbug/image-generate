/**
 * 解析每次请求要使用的上游 API 凭证。
 * 只认请求头（用户在浏览器「API 与模型设置」里填的值），不再回落到环境变量：
 * 没填自己的 BaseURL + Key 就不能用。后端不持久化凭证，只是临时使用并转发到上游。
 */
export type ApiCredentials = {
  baseUrl: string;
  apiKey: string;
};

export const MISSING_CREDENTIALS_ERROR =
  "请先点击页面右上角 ⚙️，填写你自己的 API 地址（BaseURL）和 API Key";

export function resolveCredentials(req: Request): ApiCredentials | null {
  const baseUrl = req.headers.get("x-image-api-base-url")?.trim();
  const apiKey = req.headers.get("x-image-api-key")?.trim();

  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}
