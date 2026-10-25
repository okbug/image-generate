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
  "雨夜东京街角的拉面摊，霓虹灯倒映在湿漉漉的石板路上，电影感胶片色调",
  "戴圆框眼镜的橘猫在旧书店里打盹，午后阳光穿过木窗，温暖治愈系插画",
  "漂浮在云端的蒸汽朋克图书馆，黄铜齿轮与彩绘玻璃穹顶，细节丰富",
  "极简产品摄影：琥珀色香水瓶立在米白色石台上，柔和侧光，干净背景",
  "冰岛黑沙滩上的极光之夜，一个人提着灯笼远眺，超广角，壮阔而静谧",
  "敦煌飞天风格的宇航员，飘带与星云交织，金色与青绿配色，壁画质感",
  "微缩模型风格的江南水乡清晨，乌篷船穿过石拱桥，移轴摄影效果",
  "80 年代日系城市流行唱片封面，海边公路、粉紫色夕阳与一辆白色跑车",
];

export const EDIT_DEFAULT_PROMPT =
  "提升画面清晰度与细节，让色彩更鲜明、画面更锐利";
export const MAX_UPLOAD_COUNT = 10;
export const UPLOAD_ACCEPT = "image/png,image/jpeg,image/webp";
export const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;

export type RenderedItem = {
  src: string;
  revisedPrompt?: string;
  ext: string;
  /** 图片文件字节数；上游只给 URL 时拿不到，为 undefined。 */
  bytes?: number;
  /** 下载链接；跨域的图床图片 download 属性无效，要用图床的 ?dl=1。缺省用 src。 */
  downloadHref?: string;
  /** 存在 PicBed 图床里的图（会进「最近生成」）。 */
  storeKey?: string;
  deleteToken?: string;
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
  /** 本站临时目录里的文件名；external 时为空。 */
  fileName: string;
  previewSrc: string;
  name: string;
  /** 直接引用的已有图片（如图床里的出图结果），没上传过，移除时不删服务端文件。 */
  external?: boolean;
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
    return `图片不能超过 ${MAX_UPLOAD_SIZE / 1024 / 1024}MB`;
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
