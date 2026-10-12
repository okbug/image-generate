/** 生图工坊页面共用的常量、类型和纯函数。 */

export const SIZE_OPTIONS = [
  { label: "3840×2160 · 4K横向", value: "3840x2160" },
  { label: "2160×3840 · 4K纵向", value: "2160x3840" },
  { label: "1792×1024 · 横向", value: "1792x1024" },
  { label: "1024×1792 · 纵向", value: "1024x1792" },
  { label: "1024×1024 · 方形", value: "1024x1024" },
  { label: "自定义", value: "custom" },
];

export const CUSTOM_SIZE_MIN = 256;
export const CUSTOM_SIZE_MAX = 4096;

export const QUALITY_OPTIONS = [
  { label: "标准", value: "standard" },
  { label: "高清", value: "hd" },
];

export const PROMPT_PRESETS = [
  "黄昏海边的玻璃小屋，落地窗映着粉橙色晚霞，宫崎骏风格水彩",
  "一只在月球上喝咖啡的柴犬，复古胶片质感",
  "巨大鲸鱼在云海中游弋，吉卜力梦幻场景，柔光",
  "京都樱花小巷，黄昏阳光斜照，浮世绘水彩",
];

export const EDIT_DEFAULT_PROMPT =
  "提升画面清晰度与细节，让色彩更鲜明、画面更锐利";
export const MAX_UPLOAD_COUNT = 10;
export const UPLOAD_ACCEPT = "image/png,image/jpeg,image/webp";
export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

export type RenderedItem = {
  src: string;
  revisedPrompt?: string;
  ext: string;
};

export enum Mode {
  Generate = "generate",
  Edit = "edit",
}

export enum ImageSource {
  Upload = "upload",
  Url = "url",
}

export const MODE_OPTIONS: Array<{ value: Mode; label: string }> = [
  { value: Mode.Generate, label: "生成" },
  { value: Mode.Edit, label: "编辑" },
];

export const IMAGE_SOURCE_OPTIONS: Array<{
  value: ImageSource;
  label: string;
}> = [
  { value: ImageSource.Upload, label: "上传图片" },
  { value: ImageSource.Url, label: "图片 URL" },
];

export type UploadedImage = {
  uid: string;
  url: string;
  fileName: string;
  previewSrc: string;
  name: string;
};

export function clampSide(n: number): number {
  if (!Number.isFinite(n)) return CUSTOM_SIZE_MIN;
  return Math.min(Math.max(Math.round(n), CUSTOM_SIZE_MIN), CUSTOM_SIZE_MAX);
}

export function validateUploadFile(file: File): string | null {
  if (!UPLOAD_ACCEPT.split(",").includes(file.type)) {
    return "仅支持 PNG / JPG / WebP";
  }
  if (file.size > MAX_UPLOAD_SIZE) {
    return "图片不能超过 10MB";
  }
  return null;
}

export function parseExternalUrls(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,，]+/)
        .map((url) => url.trim())
        .filter(Boolean),
    ),
  );
}

export function validateExternalUrls(urls: string[]): string | null {
  if (urls.length === 0) return "请填写图片 URL";
  if (urls.length > MAX_UPLOAD_COUNT) {
    return `最多只能填写 ${MAX_UPLOAD_COUNT} 个图片 URL`;
  }
  if (urls.some((url) => !/^https?:\/\//i.test(url))) {
    return "每个 URL 都需以 http(s):// 开头";
  }
  return null;
}
