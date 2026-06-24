// ============================================================
// HedgehogAgent 执行器
// 刺猬氛围对话 Agent
//
// 职责：
// 1. 构建刺猬 prompt → 调用 LLM → 清理输出
// 2. LLM 失败时 fallback 到本地文案池
// 3. 不修改游戏状态、不消耗回合、不触发工具
// ============================================================

import type { ChatMessage, FallbackReasonCode } from "@/services/llm/types";
import { callLLM } from "@/services/llm/client";
import {
  buildHedgehogPrompt,
  sanitizeHedgehogReply,
  getHedgehogFallback,
  type HedgehogHistoryEntry,
} from "@/agents/hedgehog/buildHedgehogPrompt";

export type HedgehogAgentRequest = {
  playerInput: string;
  conversationHistory: HedgehogHistoryEntry[];
};

export type HedgehogAgentResult = {
  reply: string;
  usedFallback: boolean;
  fallbackReason?: FallbackReasonCode;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

/**
 * 运行刺猬 Agent：构建 prompt → 调用 LLM → 清理输出。
 *
 * 完整 fallback 链：
 * 1. 环境变量缺失 → 本地文案 (provider_config_missing)
 * 2. LLM 超时/报错 → 本地文案 (provider_timeout / provider_request_failed)
 * 3. 空输出 → 本地文案 (llm_data_missing)
 *
 * 与 Eve/Adam Agent 的区别：
 * - 不输出 JSON，直接返回纯文本
 * - 不携带游戏状态
 * - 不修改任何 Chapter0State
 */
export async function runHedgehogAgent(
  req: HedgehogAgentRequest,
): Promise<HedgehogAgentResult> {
  const { playerInput, conversationHistory } = req;

  // 获取上一条刺猬回复（用于 fallback 去重）
  const lastHedgehogReply =
    conversationHistory.length > 0 &&
    conversationHistory[conversationHistory.length - 1]?.role === "hedgehog"
      ? conversationHistory[conversationHistory.length - 1]!.text
      : null;

  // ---- 1. 构建 prompt ----
  let messages: ChatMessage[];
  try {
    messages = buildHedgehogPrompt({ playerInput, conversationHistory });
  } catch {
    return {
      reply: getHedgehogFallback(lastHedgehogReply),
      usedFallback: true,
      fallbackReason: "prompt_build_failed",
    };
  }

  // ---- 2. 调用 LLM（低温度、短输出） ----
  const result = await callLLM(messages, { temperature: 0.8, maxTokens: 120 });

  // ---- 3. fallback 处理 ----
  if (!result.ok || !result.data) {
    return {
      reply: getHedgehogFallback(lastHedgehogReply),
      usedFallback: true,
      fallbackReason: result.fallbackReason ?? "llm_data_missing",
    };
  }

  const rawContent = result.data.content;
  const cleaned = sanitizeHedgehogReply(rawContent);

  // 空输出 → fallback
  if (!cleaned) {
    return {
      reply: getHedgehogFallback(lastHedgehogReply),
      usedFallback: true,
      fallbackReason: "llm_data_missing",
    };
  }

  return {
    reply: cleaned,
    usedFallback: result.usedFallback,
    fallbackReason: result.fallbackReason,
    usage: result.data.usage,
  };
}
