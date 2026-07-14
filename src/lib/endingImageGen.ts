// ============================================================
// 结局媒体（图片）纯函数解析层（Task 7 收尾 / 本轮验收修复）
//
// 不依赖 next/server 与外部网络，供 route.ts 与测试复用：
// - 图片尺寸：玩家设置 > 服务端 IMAGE_SIZE > 按 provider/model 推断
//   · Ark / Seedream / volcengine → "2K"（已验证需要 2K，1024x1024 会失败回退）
//   · 其它 OpenAI 兼容端点 → "1024x1024"（或玩家自定义）
// - 图片数量：服务端校验 1 <= count <= min(6, playedSlots)
// - Ark 响应 data[0].url（直链）与 data[0].b64_json（base64 → data: URL）
// ============================================================

/** 一次冒险最多保留六张纪念图，避免结局页长时间串行等待。 */
export const MAX_ENDING_IMAGE_COUNT = 6;

/** 根据 provider / model 推断默认尺寸（无外部依赖） */
export function defaultImageSizeFor(
  provider?: string | null,
  model?: string | null,
): string {
  const p = (provider ?? "").toLowerCase();
  const m = (model ?? "").toLowerCase();
  if (
    p.includes("seedream") ||
    p.includes("ark") ||
    p.includes("volcengine") ||
    m.includes("seedream")
  ) {
    return "2K";
  }
  return "1024x1024";
}

export type ImageSizeSource = {
  imageSize?: string;
  imageProvider?: string;
  imageModel?: string;
};

export type ImageSizeEnv = {
  IMAGE_SIZE?: string | null;
};

/** 解析最终图片尺寸：玩家本次设置优先，其次服务端 IMAGE_SIZE，再按 provider/model 推断。 */
export function resolveImageSize(
  media?: ImageSizeSource,
  env?: ImageSizeEnv,
): string {
  const player = (media?.imageSize ?? "").trim();
  if (player) return player;
  const envSize = (env?.IMAGE_SIZE ?? "").trim();
  if (envSize) return envSize;
  return defaultImageSizeFor(media?.imageProvider, media?.imageModel);
}

/** 服务端校验图片数量：1 <= count <= min(6, playedSlots)。 */
export function clampImageCount(requested: number, playedSlots: number): number {
  const max = Math.max(1, Math.min(MAX_ENDING_IMAGE_COUNT, playedSlots));
  if (!Number.isFinite(requested) || requested < 1) return 1;
  return Math.min(max, Math.floor(requested));
}

/**
 * 将图片响应中的地址转为浏览器可显示 URL：
 * - 已是 http(s) → 原样返回
 * - 已是 data: → 原样返回
 * - 裸 base64（Ark b64_json）→ 包成 data:image/png;base64,...
 */
export function toDisplayableImageUrl(raw: string): string {
  const url = (raw ?? "").trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("data:")) return url;
  return `data:image/png;base64,${url}`;
}
