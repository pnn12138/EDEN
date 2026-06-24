// ============================================================
// 守望天使 Agent 执行器
//
// 职责：
// 1. 构建 prompt → 调用 LLM → 清理输出
// 2. LLM 失败时 fallback 到本地文案池
// 3. 不直接修改游戏状态（神的注视由规则层在调用方应用）
// 4. 不接入 TTS
//
// 与 EveAgent 的区别：
// - 输出纯文本，不输出 JSON
// - 不携带信念更新意图
// - 不触发工具调用
// - 神的注视提升由调用方根据 inputTag 与地点决定
// ============================================================

import type { ChatMessage, FallbackReasonCode } from "@/services/llm/types";
import { callLLM } from "@/services/llm/client";
import {
  buildAngelPrompt,
  sanitizeAngelReply,
  getAngelFallback,
  type AngelHistoryEntry,
} from "@/agents/world/buildAngelPrompt";
import type { EdenWorldState } from "@/game/world/types";
import { naturalizeNpcReply } from "@/agents/common/naturalizeNpcReply";

export type AngelAgentRequest = {
  playerInput: string;
  state: EdenWorldState;
  conversationHistory: AngelHistoryEntry[];
};

export type AngelAgentResult = {
  reply: string;
  usedFallback: boolean;
  fallbackReason?: FallbackReasonCode;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

/**
 * 运行守望天使 Agent。
 *
 * 完整 fallback 链：
 * 1. 环境变量缺失 → 本地文案 (provider_config_missing)
 * 2. LLM 超时/报错 → 本地文案 (provider_timeout / provider_request_failed)
 * 3. 空输出 → 本地文案 (llm_data_missing)
 */
export async function runAngelAgent(req: AngelAgentRequest): Promise<AngelAgentResult> {
  const { playerInput, state, conversationHistory } = req;

  const lastAngelReply =
    conversationHistory.length > 0 &&
    conversationHistory[conversationHistory.length - 1]?.role === "angel"
      ? conversationHistory[conversationHistory.length - 1]!.text
      : null;

  // ---- 1. 构建 prompt ----
  let messages: ChatMessage[];
  try {
    messages = buildAngelPrompt({ playerInput, state, conversationHistory });
  } catch {
    return {
      reply: getAngelFallback(lastAngelReply),
      usedFallback: true,
      fallbackReason: "prompt_build_failed",
    };
  }

  // ---- 2. 调用 LLM ----
  const result = await callLLM(messages, { temperature: 0.6, maxTokens: 100 });

  // ---- 3. fallback 处理 ----
  if (!result.ok || !result.data) {
    return {
      reply: getAngelFallback(lastAngelReply),
      usedFallback: true,
      fallbackReason: result.fallbackReason ?? "llm_data_missing",
    };
  }

  const rawContent = result.data.content;
  const cleaned = sanitizeAngelReply(rawContent);

  if (!cleaned) {
    return {
      reply: getAngelFallback(lastAngelReply),
      usedFallback: true,
      fallbackReason: "llm_data_missing",
    };
  }

  // ---- 4. 自然化处理（去工程词、状态播报） ----
  const naturalized = naturalizeNpcReply(cleaned, "watching_angel");

  return {
    reply: naturalized.reply,
    usedFallback: naturalized.usedFallback || result.usedFallback,
    fallbackReason: naturalized.usedFallback
      ? "forbidden_word"
      : result.fallbackReason,
    usage: result.data.usage,
  };
}
