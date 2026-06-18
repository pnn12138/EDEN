// ============================================================
// AdamAgent 编排器
// 与 EveAgent 结构一致，调用统一 LLM 入口。
//
// 差异：
// - 使用 buildAdamPrompt 构建 prompt
// - 使用 parseAdamOutput 解析输出
// - toolCall 始终为 undefined（亚当路线不触发工具）
// - 不推进 temptationProgress
//
// fallback 链与 EveAgent 一致。
// ============================================================

import type { Chapter0State } from "@/game/types/state";
import type { AdamAgentOutput } from "@/game/types/agent";
import type { FallbackReasonCode } from "@/services/llm/types";
import { callLLM } from "@/services/llm/client";
import { buildAdamPrompt } from "@/agents/adam/buildAdamPrompt";
import { parseAdamOutput, createAdamFallbackOutput } from "@/agents/adam/parseAdamOutput";

export type AdamAgentRequest = {
  state: Chapter0State;
  playerInput: string;
  /** 之前的对话历史 */
  conversationHistory: Array<{ role: "serpent" | "eve"; text: string }>;
};

export type AdamAgentResult = {
  output: AdamAgentOutput;
  /** 是否使用了 fallback（LLM 失败 / 解析失败 / 禁用词等） */
  usedFallback: boolean;
  /** fallback 原因码（安全，不暴露密钥/URL） */
  fallbackReason?: FallbackReasonCode;
  /** 真实 token usage（provider 返回时存在） */
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

/**
 * 运行 AdamAgent：构建 prompt → 调用 LLM → 解析输出。
 */
export async function runAdamAgent(req: AdamAgentRequest): Promise<AdamAgentResult> {
  const { state, playerInput, conversationHistory } = req;

  // ---- 1. 构建 prompt ----
  let messages: ReturnType<typeof buildAdamPrompt>;
  try {
    messages = buildAdamPrompt(state, playerInput, conversationHistory);
  } catch {
    return {
      output: createAdamFallbackOutput(playerInput, "prompt_build_failed"),
      usedFallback: true,
      fallbackReason: "prompt_build_failed",
    };
  }

  // ---- 2. 调用统一 LLM 入口 ----
  const llmResult = await callLLM(messages, {
    temperature: 0.7,
    maxTokens: 512,
  });

  // LLM 层面的 fallback
  if (!llmResult.ok || llmResult.usedFallback) {
    const llmFallbackReason: FallbackReasonCode =
      llmResult.fallbackReason ??
      (llmResult.error === "provider_timeout" ? "provider_timeout" : "internal_error");

    // 如果 LLM 返回了内容（含 mock），仍尝试解析
    if (llmResult.data) {
      const parseResult = parseAdamOutput(llmResult.data.content, playerInput);
      if (parseResult.ok) {
        return {
          output: parseResult.data,
          usedFallback: true,
          fallbackReason: llmFallbackReason,
        };
      }
    }

    return {
      output: createAdamFallbackOutput(playerInput, "LLM fallback"),
      usedFallback: true,
      fallbackReason: llmFallbackReason,
    };
  }

  // ---- 3. 防御：data 必须存在 ----
  if (!llmResult.data) {
    return {
      output: createAdamFallbackOutput(playerInput, "llm_data_missing"),
      usedFallback: true,
      fallbackReason: "llm_data_missing",
    };
  }

  // ---- 4. 解析输出 ----
  const parseResult = parseAdamOutput(llmResult.data.content, playerInput);

  if (!parseResult.ok) {
    return {
      output: parseResult.fallback,
      usedFallback: true,
      fallbackReason: parseResult.error === "Forbidden word in adamReply"
        ? "forbidden_word"
        : parseResult.error === "JSON parse failed"
          ? "json_parse_failed"
          : "parse_failed",
    };
  }

  return {
    output: parseResult.data,
    usedFallback: false,
    usage: llmResult.data.usage,
  };
}
