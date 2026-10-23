import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** 当天北京时间的日期，YYYYMMDD 八位数字；与服务器所在时区无关。 */
function beijingDateCode(now = new Date()): string {
  // en-CA 的日期格式是 YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .replaceAll("-", "");
}

/** 校验 /demo 的访问密码，通过则返回演示用的 BaseURL + Key。 */
export async function POST(req: Request) {
  let body: { password?: unknown };
  try {
    body = (await req.json()) as { password?: unknown };
  } catch {
    return NextResponse.json(
      { error: "请求体不是合法的 JSON" },
      { status: 400 },
    );
  }

  const password =
    typeof body.password === "string" ? body.password.trim() : "";
  if (password !== beijingDateCode()) {
    return NextResponse.json({ error: "密码错误" }, { status: 401 });
  }

  // 演示凭证放在 .env.local（不入库），密码对了才下发，不打进前端 JS
  const baseUrl = process.env.DEMO_API_BASE_URL?.trim();
  const apiKey = process.env.DEMO_API_KEY?.trim();
  if (!baseUrl || !apiKey) {
    return NextResponse.json(
      { error: "演示配置尚未就绪，请稍后再来" },
      { status: 503 },
    );
  }

  return NextResponse.json({ baseUrl, apiKey });
}
