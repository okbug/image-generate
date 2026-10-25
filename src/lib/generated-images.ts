import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  type ImageItem,
  type ImagesGenerationsResponse,
  extFromFormat,
} from "@/types/images";

import { UPLOAD_TMP_ROUTE, getUploadTmpDir } from "./upload-store";

/**
 * 把上游返回的 b64_json 落盘到临时目录（文件名带 `gen-` 标识，30 分钟后随临时图一起清理），
 * 响应里只留 url + bytes，前端不用再持有整张图的 base64。
 * 某一张写盘失败时保留它原来的 b64_json，不让用户白等。
 */
export async function storeGeneratedImages(
  result: ImagesGenerationsResponse,
  origin: string,
): Promise<ImagesGenerationsResponse> {
  if (!Array.isArray(result?.data)) return result;

  const dir = getUploadTmpDir();
  try {
    await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
  } catch {
    return result;
  }

  const ext = extFromFormat(result.output_format);
  const data = await Promise.all(
    result.data.map(async (item): Promise<ImageItem> => {
      if (!item.b64_json) return item;
      try {
        const buffer = Buffer.from(item.b64_json, "base64");
        const fileName = `${Date.now()}-gen-${crypto.randomUUID()}.${ext}`;
        await writeFile(
          /*turbopackIgnore: true*/ path.join(
            /*turbopackIgnore: true*/ dir,
            fileName,
          ),
          buffer,
        );
        // 上游可能还带 generation_id / model 等字段，原样保留，只换掉 b64_json
        const stored: ImageItem = {
          ...item,
          url: `${origin}${UPLOAD_TMP_ROUTE}/${fileName}`,
          bytes: buffer.length,
        };
        delete stored.b64_json;
        return stored;
      } catch {
        return item;
      }
    }),
  );

  return { ...result, data };
}
