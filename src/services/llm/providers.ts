// ============================================================
// LLM Provider 实现
// Phase 4：多 Provider 适配层
//
// 职责：
// 1. 从环境变量解析当前 provider 及其配置
// 2. 实现 volcengine / deepseek / mock 三种 provider
// 3. 所有 provider 共用 OpenAI Chat Completion 风格调用
//
// 安全：
// - 只在服务端运行
// - 不暴露 API Key
// - 错误信息不含敏感数据
// ============================================================

import type {
  LLMProvider,
  LLMProviderConfig,
  ChatMessage,
  LLMCallResult,
} from "./types";

const LLM_TIMEOUT_MS = 15_000;

// ============================================================
// Provider 配置解析
// ============================================================

/**
 * 从环境变量解析当前 LLM_PROVIDER。
 * 默认 fallback 为 "mock"。
 */
export function resolveProvider(): LLMProvider {
  const raw = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (raw === "volcengine" || raw === "deepseek" || raw === "mock") {
    return raw;
  }
  return "mock";
}

/**
 * 根据当前 provider 读取对应环境变量配置。
 * 任一变量缺失 → 返回 null → 触发 fallback。
 */
export function resolveProviderConfig(
  provider: LLMProvider,
): LLMProviderConfig | null {
  switch (provider) {
    case "volcengine": {
      const apiKey = process.env.VOLCENGINE_API_KEY;
      const baseUrl = process.env.VOLCENGINE_BASE_URL;
      const model = process.env.VOLCENGINE_MODEL;
      if (!apiKey || !baseUrl || !model) return null;
      return { apiKey, baseUrl, model };
    }
    case "deepseek": {
      const apiKey = process.env.DEEPSEEK_API_KEY;
      const baseUrl = process.env.DEEPSEEK_BASE_URL;
      const model = process.env.DEEPSEEK_MODEL;
      if (!apiKey || !baseUrl || !model) return null;
      return { apiKey, baseUrl, model };
    }
    case "mock":
      return { apiKey: "mock", baseUrl: "mock", model: "mock" };
  }
}

// ============================================================
// OpenAI-compatible Chat Completion 调用
// ============================================================

/**
 * 调用 OpenAI 兼容的 Chat Completion API。
 * 火山引擎和 DeepSeek 都使用此接口。
 *
 * 错误信息不含 API Key / Base URL 等敏感数据。
 */
export async function callOpenAICompatible(
  messages: ChatMessage[],
  config: LLMProviderConfig,
  provider: LLMProvider,
  temperature: number = 0.7,
  maxTokens: number = 512,
): Promise<LLMCallResult> {
  const url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `provider_request_failed`,
        usedFallback: false,
      };
    }

    const data = await response.json();
    const content: string | undefined =
      data?.choices?.[0]?.message?.content ?? undefined;

    if (typeof content !== "string" || content.trim().length === 0) {
      return {
        ok: false,
        error: "provider_request_failed",
        usedFallback: false,
      };
    }

    // 提取 token usage（OpenAI-compatible 响应格式）
    const usage = data?.usage &&
      typeof data.usage.prompt_tokens === "number" &&
      typeof data.usage.completion_tokens === "number"
      ? {
          prompt_tokens: data.usage.prompt_tokens as number,
          completion_tokens: data.usage.completion_tokens as number,
          total_tokens: (typeof data.usage.total_tokens === "number"
            ? data.usage.total_tokens
            : data.usage.prompt_tokens + data.usage.completion_tokens) as number,
        }
      : undefined;

    return {
      ok: true,
      data: { content, provider, model: config.model, usage },
      usedFallback: false,
    };
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return {
        ok: false,
        error: "provider_timeout",
        usedFallback: false,
      };
    }
    return {
      ok: false,
      error: "provider_request_failed",
      usedFallback: false,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================
// Mock Provider（本地固定回复，不调用任何外部 API）
// ============================================================

/**
 * Mock provider：返回一个固定的 JSON 格式回复。
 * 用于开发测试和环境变量缺失时的 fallback。
 */
export async function callMockProvider(
  messages: ChatMessage[],
): Promise<LLMCallResult> {
  // 模拟延迟
  await new Promise((r) => setTimeout(r, 300));

  const mockReply = `我听见了你的声音。可我仍然记得祂说不可吃。你说的这些，让我开始思考为什么。`;

  const content = JSON.stringify({
    eveReply: mockReply,
    inputTag: "tempt_wisdom",
    toolCall: null,
  });

  return {
    ok: true,
    data: {
      content,
      provider: "mock",
      model: "mock",
    },
    usedFallback: true,
    fallbackReason: "mock_provider",
  };
}
