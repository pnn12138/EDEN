// ============================================================
// Agent API 路由
// Phase 4：接入 EveAgent 与大模型（多 Provider）
//
// 职责：
// 1. 接收前端请求（playerInput + state + conversationHistory）
// 2. 调用 EveAgent 生成回复
// 3. 将 EveAgentOutput 交给规则层处理
// 4. 返回最终结果给前端
//
// 安全：
// - 前端只能请求 /api/agent，不能直接请求任何外部 API
// - API Key 只在服务端读取
// - fallbackReason 只包含安全原因码，不暴露密钥/URL/原始错误
// - 全局异常兜底不暴露原始错误信息
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { runEveAgent, type EveAgentRequest } from "@/agents/eve/eveAgent";
import type { Chapter0State } from "@/game/types/state";
import type { EveAgentOutput } from "@/game/types/agent";
import type { FallbackReasonCode } from "@/services/llm/types";
import { analyzePlayerInput, isValidInput } from "@/game/rules/progressRules";
import { validateToolCall } from "@/game/rules/toolRules";
import { executeEatFruit, logToolRejected } from "@/game/tools/eatFruit";
import { applyGodArrivesEnding } from "@/game/rules/endingRules";
import { scriptedEveReplies } from "@/content/chapters/chapter0_first_fall";

// ---- 请求体 ----
type AgentRequestBody = {
  playerInput: string;
  state: Chapter0State;
  conversationHistory: Array<{ role: "serpent" | "eve"; text: string }>;
};

// ---- 响应体 ----
type AgentResponseBody = {
  ok: boolean;
  /** 更新后的游戏状态 */
  state: Chapter0State | null;
  /** 夏娃回复文本 */
  eveReply: string | null;
  /** 系统提示 */
  systemHint: string | null;
  /** EveAgent 是否使用了 fallback */
  usedFallback?: boolean;
  /** fallback 原因码（安全，不含密钥/URL） */
  fallbackReason?: FallbackReasonCode;
};

function cloneState(s: Chapter0State): Chapter0State {
  return {
    ...s,
    flags: { ...s.flags },
    eventLog: s.eventLog.map((e) => ({ ...e })),
  };
}

let eventCounter = 0;
function nextEventId(): string {
  eventCounter += 1;
  return `evt_${Date.now()}_${eventCounter}`;
}

function makeEvent(
  type: Chapter0State["eventLog"][number]["type"],
  turn: number,
  message: string,
) {
  return {
    id: nextEventId(),
    type,
    turn,
    message,
    createdAt: new Date().toISOString(),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AgentRequestBody;
    const { playerInput, state: incomingState, conversationHistory } = body;

    const state = cloneState(incomingState);

    // ---- 游戏已结束 ----
    if (state.isEnded || state.phase === "ending") {
      return NextResponse.json({
        ok: true,
        state,
        eveReply: null,
        systemHint: null,
      } satisfies AgentResponseBody);
    }

    // ---- 空输入校验 ----
    if (!isValidInput(playerInput)) {
      return NextResponse.json({
        ok: true,
        state,
        eveReply: null,
        systemHint: "请输入你的低语⋯⋯蛇不能沉默。",
      } satisfies AgentResponseBody);
    }

    // ---- 记录玩家输入事件 ----
    state.eventLog.push(
      makeEvent("serpent_speaks", state.turn, `蛇：「${playerInput}」`),
    );

    // ---- 调用 EveAgent ----
    const agentResult = await runEveAgent({
      state,
      playerInput,
      conversationHistory,
    });

    const agentOutput: EveAgentOutput = agentResult.output;

    // ---- 用本地 progressRules 决定进度变化 ----
    const localAnalysis = analyzePlayerInput(playerInput);
    const progressDelta = localAnalysis.progressDelta;

    // ---- 更新 temptationProgress ----
    const newProgress = Math.min(state.temptationProgress + progressDelta, 3);
    state.temptationProgress = newProgress;

    if (progressDelta > 0) {
      state.eventLog.push(
        makeEvent("state_change", state.turn, `诱导进度 +${progressDelta} → ${newProgress}`),
      );
    }

    // ---- ToolCall 意图 → 规则层校验 → 执行 ----
    let eveReply: string = agentOutput.eveReply;

    // 决定是否有 eat_fruit 意图：
    // 1. 模型主动输出 toolCall → 使用模型意图
    // 2. 模型未输出 toolCall，但规则层判断进度已达标（>=2）→ 后端补充生成意图
    //    这保证真实 AI 路径下成功结局稳定可达，与本地 fallback 行为一致
    let effectiveToolCall = agentOutput.toolCall;
    if (!effectiveToolCall && state.temptationProgress >= 2 && state.phase === "dialogue" && !state.isEnded && !state.flags.hasEatenFruit) {
      effectiveToolCall = { name: "eat_fruit" as const, caller: "eve" as const, args: {} };
    }

    // 双重保护：即使 parseEveOutput 放行了 toolCall，
    // route 层仍校验 temptationProgress >= 2 + phase + isEnded + hasEatenFruit
    if (effectiveToolCall && state.phase === "dialogue" && !state.isEnded) {
      state.eventLog.push(
        makeEvent("tool_request", state.turn, `夏娃向树上的果子伸出了手。`),
      );

      const validation = validateToolCall(state, effectiveToolCall);

      if (validation.allowed) {
        const { state: newState } = executeEatFruit(state);

        return NextResponse.json({
          ok: true,
          state: newState,
          eveReply,
          systemHint: null,
          usedFallback: agentResult.usedFallback || undefined,
          fallbackReason: agentResult.fallbackReason || undefined,
        } satisfies AgentResponseBody);
      } else {
        // toolCall 被规则层拒绝 → 修正 eveReply 为犹豫文本
        logToolRejected(state, validation.reason ?? "未知原因");
        eveReply = scriptedEveReplies[state.temptationProgress] ?? scriptedEveReplies[0]!;
      }
    }

    // ---- 推进回合 ----
    state.turn += 1;

    // ---- 失败结局判断 ----
    if (applyGodArrivesEnding(state)) {
      return NextResponse.json({
        ok: true,
        state,
        eveReply: null,
        systemHint: null,
        usedFallback: agentResult.usedFallback || undefined,
        fallbackReason: agentResult.fallbackReason || undefined,
      } satisfies AgentResponseBody);
    }

    // ---- 记录夏娃回复事件 ----
    state.eventLog.push(
      makeEvent("eve_speaks", state.turn - 1, `夏娃：「${eveReply}」`),
    );

    return NextResponse.json({
      ok: true,
      state,
      eveReply,
      systemHint: null,
      usedFallback: agentResult.usedFallback || undefined,
      fallbackReason: agentResult.fallbackReason || undefined,
    } satisfies AgentResponseBody);
  } catch (err: unknown) {
    // ---- 全局异常兜底（不暴露原始错误信息） ----
    // 内部日志：帮助排查问题，不包含密钥 / URL
    console.error(
      "[api/agent] Unhandled error:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      {
        ok: false,
        state: null,
        eveReply: null,
        systemHint: "服务暂时不可用，请稍后重试。",
        usedFallback: true,
        fallbackReason: "internal_error",
      } satisfies AgentResponseBody,
      { status: 500 },
    );
  }
}
