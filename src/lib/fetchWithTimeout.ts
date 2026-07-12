// 带超时控制的 fetch 封装（客户端用）。
// 用于在 AI 接口无响应 / 卡死时可靠中断，避免界面长期 loading。
// 超时后 fetch 抛出 AbortError，由调用方 catch 统一复位 isLoading 并提示。

export const DEFAULT_FETCH_TIMEOUT_MS = 18_000;

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
