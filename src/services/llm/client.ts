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
  options?: { temperature?: number; maxTokens?: number },
): Promise<LLMCallResult> {
  const provider = resolveProvider();
  const config = resolveProviderConfig(provider);

  // ---- Provider 配置缺失 → fallback 到 mock ----
  if (!config && provider !== "mock") {
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
          : "provider_request_failed";

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
