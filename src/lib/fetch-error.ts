/**
 * fetch 失败时 Node 只给一句 "TypeError: fetch failed"，真正原因（ECONNREFUSED、
 * DNS 解析失败、证书错误、超时等）在 err.cause 里，这里一起拼出来透传给前端。
 */
export function describeFetchError(err: unknown): string {
  const lines = [String(err)];
  let cause = err instanceof Error ? err.cause : undefined;
  while (cause && lines.length < 5) {
    const code = (cause as { code?: unknown }).code;
    const text = String(cause);
    lines.push(
      `cause: ${typeof code === "string" && !text.includes(code) ? `${code} ` : ""}${text}`,
    );
    cause = cause instanceof Error ? cause.cause : undefined;
  }
  return lines.join("\n");
}
