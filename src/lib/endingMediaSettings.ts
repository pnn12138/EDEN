// ============================================================
// 结局媒体（图片/视频）自定义配置（Task 6 Step 3 / Task 7 Step 3）
//
// 重要约束：
// - 仅存于当前浏览器 sessionStorage，绝不进入 EdenWorldState、localStorage 存档、
//   React URL、错误信息或日志。
// - 每次请求时由前端随请求体临时传入后端，后端本次请求使用后即丢弃。
// - 仅允许 HTTPS；拒绝 localhost / 回环 / 私网 IP / file / data URL。
// - 仅保存图片生成配置；视频能力已从第一章结局流程移除。
// ============================================================

export type EndingMediaSettings = {
  /** 图像 Provider（空 = 继承服务端环境变量） */
  imageProvider: string;
  /** 图像 Key（password 类型，绝不回显） */
  imageKey: string;
  /** 图像 Base URL（可选；空 = 服务端默认） */
  imageBaseUrl: string;
  /** 图像模型（可选；空 = 服务端默认） */
  imageModel: string;
  /** 图像尺寸（可选；空 = 服务端默认；Ark/Seedream 默认 2K，其他 OpenAI 兼容默认 1024x1024） */
  imageSize: string;
  /** 用户希望生成的最多图片数（服务端仍会按已游玩时段和 6 张上限裁剪） */
  imageCount: number;
  /** 用户对结局图片集的创作希望，仅作为分镜提示素材 */
  imageHope: string;
};

export const SESSION_STORAGE_KEY = "eden:chapter1:ending-media-settings";

export function defaultEndingMediaSettings(): EndingMediaSettings {
  return {
    imageProvider: "",
    imageKey: "",
    imageBaseUrl: "",
    imageModel: "",
    imageSize: "",
    imageCount: 3,
    imageHope: "",
  };
}

export type UrlCheckResult = { ok: boolean; reason?: string };

/**
 * 校验外部地址：仅允许 https；拒绝 localhost、回环(127.0.0.0/8, ::1)、
 * 私网(10/172.16-31/192.168)、file:/data: 等危险方案。
 * 空字符串视为"使用服务端默认"，返回 ok。
 */
export function checkEndpointUrl(raw: string): UrlCheckResult {
  const url = (raw ?? "").trim();
  if (url === "") return { ok: true };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: "地址格式无效" };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "仅允许 HTTPS 地址" };
  }
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host === "::1" || host === "0.0.0.0") {
    return { ok: false, reason: "不允许本地地址" };
  }
  // 简单私网/IP 段匹配
  if (/^127\./.test(host)) return { ok: false, reason: "不允许回环地址" };
  if (/^10\./.test(host)) return { ok: false, reason: "不允许私网地址" };
  if (/^192\.168\./.test(host)) return { ok: false, reason: "不允许私网地址" };
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return { ok: false, reason: "不允许私网地址" };
  return { ok: true };
}

export type ValidationResult = { ok: boolean; errors: Record<string, string> };

/** 校验整套配置（仅 URL 字段参与；Key 不在此校验内容，仅类型） */
export function validateEndingMediaSettings(s: EndingMediaSettings): ValidationResult {
  const errors: Record<string, string> = {};
  const imageBase = checkEndpointUrl(s.imageBaseUrl);
  if (!imageBase.ok) errors.imageBaseUrl = imageBase.reason ?? "地址不合法";
  return { ok: Object.keys(errors).length === 0, errors };
}

/** 从 sessionStorage 读取（无/损坏时返回默认） */
export function loadEndingMediaSettings(): EndingMediaSettings {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return defaultEndingMediaSettings();
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return defaultEndingMediaSettings();
    const parsed = JSON.parse(raw) as Partial<EndingMediaSettings>;
    return { ...defaultEndingMediaSettings(), ...parsed };
  } catch {
    return defaultEndingMediaSettings();
  }
}

/** 写入 sessionStorage（调用方应先 validate；不合法的 URL 不会被持久化） */
export function saveEndingMediaSettings(s: EndingMediaSettings): ValidationResult {
  const result = validateEndingMediaSettings(s);
  if (!result.ok) return result;
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(s));
    }
  } catch {
    /* sessionStorage 不可用时静默忽略 */
  }
  return result;
}

/** 清空 sessionStorage 配置（不触碰游戏存档） */
export function clearEndingMediaSettings(): void {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    /* noop */
  }
}

/** 是否配置了可用的图像生成（任一 provider/baseUrl/model 非空即视为已配置） */
export function hasImageConfig(s: EndingMediaSettings): boolean {
  return Boolean(s.imageProvider || s.imageBaseUrl || s.imageModel);
}

