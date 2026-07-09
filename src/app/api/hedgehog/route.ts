// ============================================================
// 刺猬氛围对话 API 路由
//
// 与 /api/agent 的区别：
// - 不修改 Chapter0State（不推进回合、不改变进度、不触发结局）
// - 不调用工具、不检索记忆、不更新信念
// - 仅返回刺猬的纯文本回复
// - 不接入 TTS
//
// 安全：
// - 只在服务端运行，不暴露 API Key
// - 全局异常兜底不暴露原始错误信息
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { runHedgehogAgent } from "@/agents/hedgehog/hedgehogAgent";
import type { FallbackReasonCode } from "@/services/llm/types";

// ---- 请求体 ----
type HedgehogRequestBody = {
  playerInput: string;
  conversationHistory: Array<{ role: "serpent" | "hedgehog"; text: string }>;
};

// ---- 响应体 ----
type HedgehogResponseBody = {
  ok: boolean;
  reply: string | null;
  usedFallback?: boolean;
  fallbackReason?: FallbackReasonCode;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as HedgehogRequestBody;
    const { playerInput, conversationHistory } = body;

    // ---- 空输入校验 ----
    if (!playerInput || !playerInput.trim()) {
      return NextResponse.json({
        ok: true,
        reply: null,
      } satisfies HedgehogResponseBody);
    }

    // ---- 调用刺猬 Agent（不修改任何游戏状态） ----
    const result = await runHedgehogAgent({
      playerInput: playerInput.trim(),
      conversationHistory,
    });

    return NextResponse.json({
      ok: true,
      reply: result.reply,
      usedFallback: result.usedFallback || undefined,
      fallbackReason: result.fallbackReason || undefined,
      usage: result.usage || undefined,
    } satisfies HedgehogResponseBody);
  } catch (err: unknown) {
    console.error(
      "[api/hedgehog] Unhandled error:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      {
        ok: false,
        reply: null,
        usedFallback: true,
        fallbackReason: "internal_error",
      } satisfies HedgehogResponseBody,
      { status: 500 },
    );
  }
}
