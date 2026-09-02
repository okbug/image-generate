import { readFile, stat } from "node:fs/promises";
import { getUploadMime, resolveUploadFilePath } from "@/lib/upload-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function notFound() {
  return new Response("Not Found", { status: 404 });
}

async function serveUpload(fileName: string, includeBody: boolean) {
  const filePath = resolveUploadFilePath(fileName);
  if (!filePath) return notFound();

  try {
    const fileStat = await stat(/*turbopackIgnore: true*/ filePath);
    if (!fileStat.isFile()) return notFound();

    const headers = new Headers({
      "Content-Type": getUploadMime(fileName),
      "Content-Length": String(fileStat.size),
      "Cache-Control": "public, max-age=0, must-revalidate",
    });

    if (!includeBody) return new Response(null, { headers });

    const file = await readFile(/*turbopackIgnore: true*/ filePath);
    return new Response(new Uint8Array(file), { headers });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return notFound();
    return new Response("Failed to read image", { status: 500 });
  }
}

export async function GET(
  _req: Request,
  ctx: RouteContext<"/images/tmp/[name]">,
) {
  const { name } = await ctx.params;
  return serveUpload(name, true);
}

export async function HEAD(
  _req: Request,
  ctx: RouteContext<"/images/tmp/[name]">,
) {
  const { name } = await ctx.params;
  return serveUpload(name, false);
}
