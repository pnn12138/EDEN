// ============================================================
// 纯前端登录态工具（localStorage，无后端 / 接口 / 密钥）
//
// 仅用于首页 UI 展示与本地校验：
// - 账号记录存放于 `eden:user:{username}`，密码以 base64 简单编码（非加密，仅防明文窥视）
// - 登录态（token）存放于 `eden:token`
// - 游客进度标记存放于 `eden:save:guest`
// 所有读写都包裹在 try/catch 中，隐私模式等异常时静默降级。
// ============================================================

export type AuthMode = "user" | "guest";

export type AuthState = {
  mode: AuthMode;
  username: string | null;
};

const TOKEN_KEY = "eden:token";
const GUEST_KEY = "eden:save:guest";
const REMEMBER_KEY = "eden:remember-user";

type TokenPayload = AuthState & { loginAt: number };

/** localStorage 键名：eden:user:{username} */
export function userRecordKey(username: string): string {
  return `eden:user:${username}`;
}

/** base64 简单编码（UTF-8 安全），用于本地存储密码的轻度混淆 */
export function encodePassword(raw: string): string {
  const bytes = new TextEncoder().encode(raw);
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin);
}

/** 读取当前登录态；无则返回 null */
export function getAuth(): AuthState | null {
  try {
    const raw = window.localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TokenPayload;
    if (parsed.mode === "guest") return { mode: "guest", username: null };
    if (parsed.mode === "user" && parsed.username) {
      return { mode: "user", username: parsed.username };
    }
    return null;
  } catch {
    return null;
  }
}

export type LoginResult = { ok: true } | { ok: false; error: string };

/**
 * 登录 / 注册（纯前端）：
 * - 账号不存在 → 自动注册
 * - 账号存在 → 校验密码，错误返回提示
 */
export function login(username: string, password: string): LoginResult {
  const key = userRecordKey(username);
  let record: string | null = null;
  try {
    record = window.localStorage.getItem(key);
  } catch {
    record = null;
  }

  if (!record) {
    // 自动注册
    try {
      window.localStorage.setItem(key, encodePassword(password));
      window.localStorage.setItem(
        TOKEN_KEY,
        JSON.stringify({ mode: "user", username, loginAt: Date.now() } as TokenPayload),
      );
    } catch {
      return { ok: false, error: "本地存储不可用，无法登录" };
    }
    return { ok: true };
  }

  // 已存在：校验密码
  if (record !== encodePassword(password)) {
    return { ok: false, error: "账号或密码错误" };
  }
  try {
    window.localStorage.setItem(
      TOKEN_KEY,
      JSON.stringify({ mode: "user", username, loginAt: Date.now() } as TokenPayload),
    );
  } catch {
    return { ok: false, error: "本地存储不可用，无法登录" };
  }
  return { ok: true };
}

/** 游客模式：写入游客标记并登录 */
export function loginAsGuest(): void {
  try {
    window.localStorage.setItem(GUEST_KEY, JSON.stringify({ createdAt: Date.now() }));
    window.localStorage.setItem(
      TOKEN_KEY,
      JSON.stringify({ mode: "guest", username: null, loginAt: Date.now() } as TokenPayload),
    );
  } catch {
    /* 隐私模式等：静默降级 */
  }
}

/** 退出登录（仅清除 token，保留账号记录与游客标记） */
export function logout(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* noop */
  }
}

/** 读取「记住的账号」 */
export function getRememberedUser(): string {
  try {
    return window.localStorage.getItem(REMEMBER_KEY) ?? "";
  } catch {
    return "";
  }
}

/** 设置 / 清除「记住的账号」 */
export function setRememberedUser(username: string): void {
  try {
    if (username) window.localStorage.setItem(REMEMBER_KEY, username);
    else window.localStorage.removeItem(REMEMBER_KEY);
  } catch {
    /* noop */
  }
}
