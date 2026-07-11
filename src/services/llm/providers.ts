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

// §2.1 Demo 安全网：单次超时从 30s 收紧到 15s，避免评委感知为"卡死"
const LLM_TIMEOUT_MS = 15_000;
const MIN_REASONING_MODEL_TOKENS = 1024;

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
  const effectiveMaxTokens =
    provider === "volcengine" && /code|reason/i.test(config.model)
      ? Math.max(maxTokens, MIN_REASONING_MODEL_TOKENS)
      : maxTokens;

  // 单次请求（含超时与网络异常），不计入 token 统计（失败时无 usage）。
  const attemptOnce = async (): Promise<LLMCallResult> => {
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
          max_tokens: effectiveMaxTokens,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          ok: false,
          error: "provider_request_failed",
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
  };

  const first = await attemptOnce();
  if (first.ok) return first;

  // §2.1 单次重试：仅对超时（偶发抖动）重试一次，复用同一参数。
  // 重试仍失败才返回 ok:false，由 client.ts 走 mock fallback。
  if (first.error === "provider_timeout") {
    return attemptOnce();
  }
  return first;
}

// ============================================================
// OpenAI-compatible Chat Completion 流式调用（SSE）
//
// 仅用于夏娃 / 天使低语等需要逐字呈现的场景。
// 解析 SSE 的 `data:` 行，累积 choices[0].delta.content，逐字 yield。
// 调用方负责在失败时降级到非流式 callLLM（见 client.ts）。
// ============================================================

/**
 * 流式调用 OpenAI 兼容接口，逐字 yield 增量文本。
 * 失败（网络/超时/非流支持）抛出错误，由上层降级。
 */
export async function* callOpenAICompatibleStream(
  messages: ChatMessage[],
  config: LLMProviderConfig,
  provider: LLMProvider,
  temperature: number = 0.7,
  maxTokens: number = 512,
): AsyncGenerator<string> {
  const url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const effectiveMaxTokens =
    provider === "volcengine" && /code|reason/i.test(config.model)
      ? Math.max(maxTokens, MIN_REASONING_MODEL_TOKENS)
      : maxTokens;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
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
        max_tokens: effectiveMaxTokens,
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`provider_stream_failed_${response.status}`);
    }

    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE 以 "\n\n" 分隔事件；按行解析
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const dataStr = trimmed.slice(5).trim();
        if (!dataStr || dataStr === "[DONE]") continue;
        try {
          const json = JSON.parse(dataStr);
          const delta: unknown = json?.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta.length > 0) {
            yield delta;
          }
        } catch {
          // 跳过非 JSON / 心跳行
        }
      }
    }
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("provider_timeout");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    try {
      await reader?.cancel();
    } catch {
      // 忽略取消异常
    }
  }
}

// ============================================================
// Mock Provider（本地固定回复，不调用任何外部 API）
// ============================================================

/**
 * Mock provider：按 Prompt 类型返回本地文本。
 * 用于开发测试和环境变量缺失时的 fallback。
 */
export async function callMockProvider(
  messages: ChatMessage[],
): Promise<LLMCallResult> {
  // 模拟延迟
  await new Promise((r) => setTimeout(r, 300));

  const systemText = messages.find((m) => m.role === "system")?.content ?? "";
  const wantsJson = systemText.includes("JSON 格式") || systemText.includes('"inputTag"');
  const mockReply = pickMockReply(systemText);
  const content = wantsJson
    ? JSON.stringify({
        eveReply: mockReply,
        inputTag: "tempt_wisdom",
        toolCall: null,
      })
    : mockReply;

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

function pickMockReply(systemText: string): string {
  if (systemText.includes("亚当")) {
    return "死这个词，我也只听过。祂说不可吃，我便守着这句话。";
  }
  if (systemText.includes("加百列")) {
    return "水会带走声音，也会留下回声。蛇，你的话已经碰到岸边了。";
  }
  if (systemText.includes("拉斐尔")) {
    return "先让风安静。受惊的心听不见太重的话。";
  }
  if (systemText.includes("乌列尔")) {
    return "提问比命令更轻，也更难被光立刻辨认。";
  }
  if (systemText.includes("米迦勒")) {
    return "水流出以后，就不再只属于源头。话也是如此。";
  }
  if (systemText.includes("基路伯")) {
    return "边界不回答蛇的问题。它只记得哪条路正在变窄。";
  }
  if (systemText.includes("狐狸")) {
    return "这句话太直，像爪子碰到叶面。换成问题，她才会自己往前走。";
  }
  if (systemText.includes("刺猬")) {
    return "草叶动了一下。我听见了，可我不敢靠太近。";
  }
  if (systemText.includes("天使")) {
    return "园中有些声音，不该靠近那棵树。";
  }
  return "死……我只听过这个词。若它不是消失，那它会把我带到哪里？";
}
