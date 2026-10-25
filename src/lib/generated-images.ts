import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  type ImageItem,
  type ImagesGenerationsResponse,
  extFromFormat,
} from "@/types/images";

import { isPicbedConfigured, signDeleteToken, uploadToPicbed } from "./picbed";
import { UPLOAD_TMP_ROUTE, getUploadTmpDir } from "./upload-store";

/**
 * 把上游返回的 b64_json 存起来，响应里只留 url + bytes，前端不用再持有整张图的 base64。
 * 每张图按顺序尝试：
 *   1. PicBed 图床（长期保存，带 storeKey + deleteToken，前端「最近生成」可删除）
 *   2. 本站临时目录（文件名带 `gen-`，30 分钟后随临时图清理）
 *   3. 都失败就保留原来的 b64_json，不让用户白等
 */
export async function storeGeneratedImages(
  result: ImagesGenerationsResponse,
  origin: string,
): Promise<ImagesGenerationsResponse> {
  if (!Array.isArray(result?.data)) return result;

  const ext = extFromFormat(result.output_format);
  const data = await Promise.all(
    result.data.map(async (item): Promise<ImageItem> => {
      if (!item.b64_json) return item;
      const buffer = Buffer.from(item.b64_json, "base64");
      const fileName = `gen-${crypto.randomUUID()}.${ext}`;

      // 上游可能还带 generation_id / model 等字段，原样保留，只换掉 b64_json
      const base: ImageItem = { ...item, bytes: buffer.length };
      delete base.b64_json;

      if (isPicbedConfigured()) {
        try {
          const { url, storeKey } = await uploadToPicbed(buffer, fileName);
          return {
            ...base,
            url,
            storeKey,
            deleteToken: signDeleteToken(storeKey),
          };
        } catch (err) {
          console.error(
            "[generated-images] PicBed 上传失败，回落到临时图",
            err,
          );
        }
      }

      try {
        const dir = getUploadTmpDir();
        const tmpName = `${Date.now()}-${fileName}`;
        await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
        await writeFile(
          /*turbopackIgnore: true*/ path.join(
            /*turbopackIgnore: true*/ dir,
            tmpName,
          ),
          buffer,
        );
        return { ...base, url: `${origin}${UPLOAD_TMP_ROUTE}/${tmpName}` };
      } catch {
        return item;
      }
    }),
  );

  return { ...result, data };
}
