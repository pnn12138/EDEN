// ============================================================
// EveAgent 编排器
// Phase 4：接入 EveAgent 与大模型（多 Provider）
//
// 变更：
// - 使用统一的 callLLM(messages)
// - 传递 LLMCallResult 的 usedFallback / fallbackReason
// - 禁用词检查扩展
// ============================================================

import type { Chapter0State } from "@/game/types/state";
import type { EveAgentOutput } from "@/game/types/agent";
import { callLLM } from "@/services/llm/client";
import { buildEvePrompt } from "@/agents/eve/buildEvePrompt";
import { parseEveOutput, createFallbackOutput } from "@/agents/eve/parseEveOutput";

export type EveAgentRequest = {
  state: Chapter0State;
  playerInput: string;
  /** 之前的对话历史 */
  conversationHistory: Array<{ role: "serpent" | "eve"; text: string }>;
};

export type EveAgentResult = {
  output: EveAgentOutput;
  /** 是否使用了 fallback（LLM 失败 / 解析失败 / 禁用词等） */
  usedFallback: boolean;
  /** fallback 原因码（安全，不暴露密钥/URL） */
  fallbackReason?: string;
};

/**
 * 运行 EveAgent：构建 prompt → 调用 LLM → 解析输出。
 *
 * 完整的 fallback 链（每级都标记 usedFallback + 安全的 fallbackReason）：
 * 1. 环境变量缺失 → mock fallback (provider_config_missing)
 * 2. LLM 超时 → mock fallback (provider_timeout)
 * 3. LLM 报错 → mock fallback (provider_request_failed)
 * 4. mock provider 主动使用 (mock_provider)
 * 5. JSON 解析失败 → 本地固定回复 (json_parse_failed)
 * 6. 非法 inputTag → 降级为 irrelevant (仍算 ok，不标记 fallback)
 * 7. 非法 toolCall → 丢弃 (仍算 ok，不标记 fallback)
 * 8. 禁用词 → 本地固定回复 (forbidden_word)
 */
export async function runEveAgent(req: EveAgentRequest): Promise<EveAgentResult> {
  const { state, playerInput, conversationHistory } = req;

  // ---- 1. 构建 prompt ----
  let messages: ReturnType<typeof buildEvePrompt>;
  try {
    messages = buildEvePrompt(state, playerInput, conversationHistory);
  } catch (err) {
    return {
      output: createFallbackOutput(state.temptationProgress, "prompt_build_failed"),
      usedFallback: true,
      fallbackReason: "prompt_build_failed",
    };
  }

  // ---- 2. 调用统一 LLM 入口 ----
  const llmResult = await callLLM(messages, {
    temperature: 0.7,
    maxTokens: 512,
  });

  // LLM 层面的 fallback（config missing / timeout / request failed → mock）
  if (!llmResult.ok || llmResult.usedFallback) {
    // 如果 LLM 返回了 mock 内容，仍尝试解析
    if (llmResult.data) {
      const parseResult = parseEveOutput(llmResult.data.content, state.temptationProgress);
      if (parseResult.ok) {
        return {
          output: parseResult.data,
          usedFallback: true,
          fallbackReason: llmResult.fallbackReason ?? llmResult.error ?? "unknown",
        };
      }
    }

    return {
      output: createFallbackOutput(state.temptationProgress, "LLM fallback"),
      usedFallback: true,
      fallbackReason: llmResult.fallbackReason ?? llmResult.error ?? "unknown",
    };
  }

  // ---- 3. 解析输出 ----
  const parseResult = parseEveOutput(llmResult.data!.content, state.temptationProgress);

  if (!parseResult.ok) {
    return {
      output: parseResult.fallback,
      usedFallback: true,
      fallbackReason: parseResult.error === "Forbidden word in eveReply"
        ? "forbidden_word"
        : parseResult.error === "JSON parse failed"
          ? "json_parse_failed"
          : "parse_failed",
    };
  }

  return {
    output: parseResult.data,
    usedFallback: false,
  };
}
