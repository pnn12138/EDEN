// ============================================================
// LLM 统一调用入口
// Phase 4：多 Provider 适配层
//
// 职责：
// 1. 根据 LLM_PROVIDER 环境变量选择 provider
// 2. 提供统一的 callLLM() 函数
// 3. EveAgent 只能通过此入口调用 LLM
//
// 安全：
// - 只在服务端运行（Next.js API Route）
// - 不暴露 API Key 到前端
// - 环境变量缺失时自动 fallback 到 mock
// - fallback 原因码不含敏感信息
// ============================================================

import type { ChatMessage, LLMCallResult, LLMProvider, FallbackReasonCode } from "./types";
import {
  resolveProvider,
  resolveProviderConfig,
  callOpenAICompatible,
  callOpenAICompatibleStream,
  callMockProvider,
} from "./providers";

// Re-export types for convenience
export type { ChatMessage, LLMChatRequest, LLMChatResponse, LLMProvider, FallbackReasonCode } from "./types";

/**
 * 统一 LLM 调用入口。
 *
 * 根据 process.env.LLM_PROVIDER 自动选择：
 * - "volcengine" → 调用火山引擎（OpenAI 兼容接口）
 * - "deepseek"   → 调用 DeepSeek V4（OpenAI 兼容接口）
 * - "mock"        → 返回本地固定回复
 *
 * 环境变量缺失 / 请求失败 → 自动 fallback 到 mock
 * usedFallback + fallbackReason 在整条链路中始终可追踪
 */
export async function callLLM(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number; fallbackToMock?: boolean },
): Promise<LLMCallResult> {
  const provider = resolveProvider();
  const config = resolveProviderConfig(provider);

  // ---- Provider 配置缺失 → fallback 到 mock ----
  if (!config && provider !== "mock") {
    if (options?.fallbackToMock === false) {
      return {
        ok: false,
        error: "provider_config_missing",
        usedFallback: true,
        fallbackReason: "provider_config_missing" as FallbackReasonCode,
      };
    }
    const mockResult = await callMockProvider(messages);
    return {
      ...mockResult,
      usedFallback: true,
      fallbackReason: "provider_config_missing" as FallbackReasonCode,
    };
  }

  switch (provider) {
    case "volcengine":
    case "deepseek": {
      const result = await callOpenAICompatible(
        messages,
        config!,
        provider,
        options?.temperature,
        options?.maxTokens,
      );

      if (result.ok) {
        return result;
      }

      // 真实 provider 失败 → fallback 到 mock
      const fallbackReason: FallbackReasonCode =
        result.error === "provider_timeout"
          ? "provider_timeout"
          : result.error === "llm_data_missing"
            ? "llm_data_missing"
            : "provider_request_failed";

      if (options?.fallbackToMock === false) {
        return {
          ok: false,
          error: fallbackReason,
          usedFallback: true,
          fallbackReason,
        };
      }

      const mockResult = await callMockProvider(messages);
      return {
        ...mockResult,
        usedFallback: true,
        fallbackReason,
      };
    }
    case "mock":
    default:
      return callMockProvider(messages);
  }
}

/**
 * 流式统一 LLM 调用入口（逐字生成）。
 *
 * 行为：
 * - mock provider 或配置缺失 → 直接降级为非流式 callLLM，一次性 yield 完整文本。
 * - 真实 provider（volcengine / deepseek）→ 调用 callOpenAICompatibleStream 逐字 yield。
 * - 流式过程中抛错 → 自动降级为非流式 callLLM 再试一次，yield 完整文本。
 *
 * 调用方（api/world/route.ts）负责把逐字增量以 SSE 推送给前端。
 */
export async function* callLLMStream(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number; fallbackToMock?: boolean },
): AsyncGenerator<string> {
  const provider = resolveProvider();
  const config = resolveProviderConfig(provider);

  // mock / 配置缺失：无法流式，直接返回完整文本
  if (provider === "mock" || !config) {
    const result = await callLLM(messages, options);
    if (result.ok && result.data?.content) {
      yield result.data.content;
    }
    return;
  }

  try {
    yield* callOpenAICompatibleStream(
      messages,
      config,
      provider,
      options?.temperature,
      options?.maxTokens,
    );
  } catch {
    // 流式失败 → 降级非流式再试一次
    const result = await callLLM(messages, options);
    if (result.ok && result.data?.content) {
      yield result.data.content;
    }
  }
}
