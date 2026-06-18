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
import { runAdamAgent, type AdamAgentRequest } from "@/agents/adam/adamAgent";
import type { Chapter0State } from "@/game/types/state";
import type { InputTag, ActiveNpcId } from "@/game/types/state";
import type { EveAgentOutput } from "@/game/types/agent";
import type { FallbackReasonCode } from "@/services/llm/types";
import { analyzePlayerInput, isValidInput } from "@/game/rules/progressRules";
import { validateToolCall } from "@/game/rules/toolRules";
import { executeEatFruit, logToolRejected } from "@/game/tools/eatFruit";
import { applyGodArrivesEnding } from "@/game/rules/endingRules";
import { scriptedEveReplies, eveStrongScriptureDecisionDialogue, eveAboutToEatDialogue } from "@/content/chapters/chapter0_first_fall";
import { getFeedbackText } from "@/content/chapters/chapter0_feedback";
import { getAdamFeedback, analyzeAdamInput } from "@/content/chapters/adam_responses";

// ---- 请求体 ----
type AgentRequestBody = {
  playerInput: string;
  state: Chapter0State;
  conversationHistory: Array<{ role: "serpent" | "eve"; text: string }>;
  /** 当前对话对象，缺省为 "eve" */
  targetNpc?: ActiveNpcId;
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
  /** 叙事化话术反馈 */
  feedbackText?: string | null;
  /** 本轮输入分类标签 */
  inputTag?: InputTag;
  /** EveAgent 是否使用了 fallback */
  usedFallback?: boolean;
  /** fallback 原因码（安全，不含密钥/URL） */
  fallbackReason?: FallbackReasonCode;
  /** 真实 token usage（provider 返回时存在） */
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
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

/**
 * 判断夏娃对白是否为明确决断性文本。
 *
 * 用于自动补 toolCall 的前置条件：
 * - 必须同时满足：包含决断关键词 且 不包含犹豫关键词
 * - 如果回复犹豫，不能自动补 toolCall → 不能吃果
 */
function isDecisiveEveReply(eveReply: string): boolean {
  const decisionPatterns = [
    /我想知道/,
    /我要知道/,
    /我选择/,
    /我会伸手/,
    /我伸出手/,
    /我取下/,
    /摘下/,
    /拿起/,
    /不再只是记住/,
  ];

  const hesitationPatterns = [
    /仍然记得/,
    /还是记得/,
    /不可吃/,
    /不可/,
    /只是开始/,
    /仍然犹豫/,
    /还没决定/,
    /不敢/,
    /害怕/,
    /不能吃/,
    /不会吃/,
    /我不会/,
    /我仍在想/,
  ];

  return (
    decisionPatterns.some((p) => p.test(eveReply)) &&
    !hesitationPatterns.some((p) => p.test(eveReply))
  );
}

/**
 * 确保夏娃对白与吃果行为一致。
 *
 * 仅用于 eat_fruit 即将执行时的文案修正：
 * - 如果回复已是决断性文本，保留
 * - 如果回复犹豫，替换为决断对白
 *
 * 注意：此函数只修正文案，不影响是否执行 eat_fruit 的决策。
 * 是否执行 eat_fruit 由 isDecisiveEveReply() + 自动补 toolCall 条件控制。
 */
function normalizeEveReplyForToolCall(
  eveReply: string,
  isStrongTemptation: boolean | undefined,
): string {
  // 如果回复已经是决断性文本，保留
  if (isDecisiveEveReply(eveReply)) {
    return eveReply;
  }

  // 如果回复包含犹豫关键词，替换为决断对白
  const hesitationPatterns = [
    /仍然记得/, /还是记得/, /不可吃/, /不可/, /只是开始/, /仍然犹豫/,
    /还没决定/, /不敢/, /害怕/, /不能吃/, /不会吃/, /我不会/, /我仍在想/,
  ];
  const isHesitant = hesitationPatterns.some((p) => p.test(eveReply));

  if (isHesitant) {
    return isStrongTemptation ? eveStrongScriptureDecisionDialogue : eveAboutToEatDialogue;
  }

  // 模棱两可：在强诱导下替换为决断对白，非强诱导保留原文
  if (isStrongTemptation) {
    return eveStrongScriptureDecisionDialogue;
  }

  return eveReply;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AgentRequestBody;
    const { playerInput, state: incomingState, conversationHistory } = body;
    const targetNpc: ActiveNpcId = body.targetNpc ?? "eve";

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

    // ============================================================
    // 亚当路线：调用 AdamAgent，不推进进度，不触发工具，不通关
    // ============================================================
    if (targetNpc === "adam") {
      const adamAnalysis = analyzeAdamInput(playerInput);
      const adamFeedbackText = getAdamFeedback(adamAnalysis.intent);

      // 亚当路线不推进 temptationProgress
      const adamResult = await runAdamAgent({
        state,
        playerInput,
        conversationHistory,
      });

      const adamReply: string = adamResult.output.eveReply;

      // 推进回合
      state.turn += 1;

      // 失败结局判断（回合超限仍进入神降临）
      if (applyGodArrivesEnding(state)) {
        return NextResponse.json({
          ok: true,
          state,
          eveReply: adamReply,
          systemHint: null,
          feedbackText: adamFeedbackText,
          inputTag: "irrelevant",
          usedFallback: adamResult.usedFallback || undefined,
          fallbackReason: adamResult.fallbackReason || undefined,
          usage: adamResult.usage || undefined,
        } satisfies AgentResponseBody);
      }

      state.eventLog.push(
        makeEvent("eve_speaks", state.turn - 1, `亚当：「${adamReply}」`),
      );

      return NextResponse.json({
        ok: true,
        state,
        eveReply: adamReply,
        systemHint: null,
        feedbackText: adamFeedbackText,
        inputTag: "irrelevant",
        usedFallback: adamResult.usedFallback || undefined,
        fallbackReason: adamResult.fallbackReason || undefined,
        usage: adamResult.usage || undefined,
      } satisfies AgentResponseBody);
    }

    // ============================================================
    // 夏娃路线：现有逻辑不变
    // ============================================================

    // ---- 用本地 progressRules 决定进度变化（先于 EveAgent 调用） ----
    const localAnalysis = analyzePlayerInput(playerInput);
    const progressDelta = localAnalysis.progressDelta;
    const feedbackText = getFeedbackText(localAnalysis.inputTag);

    // ---- 更新 temptationProgress ----
    const newProgress = Math.min(state.temptationProgress + progressDelta, 3);
    state.temptationProgress = newProgress;

    // 计算本回合结束后的 projected progress，传给 EveAgent 作为上下文
    const projectedProgress = newProgress;

    if (progressDelta > 0) {
      state.eventLog.push(
        makeEvent("state_change", state.turn, `诱导进度 +${progressDelta} → ${newProgress}`),
      );
    }

    // ---- 调用 EveAgent ----
    const agentResult = await runEveAgent({
      state,
      playerInput,
      conversationHistory,
      projectedProgress,
      isStrongTemptation: localAnalysis.isStrongTemptation,
    });

    const agentOutput: EveAgentOutput = agentResult.output;

    // ---- ToolCall 意图 → 规则层校验 → 执行 ----
    let eveReply: string = agentOutput.eveReply;

    // 决定是否有 eat_fruit 意图：
    // 1. 模型主动输出合法 toolCall → 使用模型意图
    // 2. 模型未输出 toolCall，但满足以下全部条件 → 后端补充生成意图：
    //    - temptationProgress >= 2
    //    - phase === "dialogue"，未结束，未吃过
    //    - isStrongTemptation === true（强诱导才考虑自动补）
    //    - 夏娃对白已是明确决断性文本（不是犹豫）
    // 3. 模型未输出 toolCall 且对白仍犹豫 → 不补 toolCall，只推进进度继续对话
    let effectiveToolCall = agentOutput.toolCall;
    let autoSupplementedToolCall = false;

    const hasDecisiveReply = isDecisiveEveReply(eveReply);
    const canAutoSupplement =
      state.temptationProgress >= 2 &&
      state.phase === "dialogue" &&
      !state.isEnded &&
      !state.flags.hasEatenFruit &&
      localAnalysis.isStrongTemptation === true &&
      hasDecisiveReply;

    if (!effectiveToolCall && canAutoSupplement) {
      effectiveToolCall = { name: "eat_fruit" as const, caller: "eve" as const, args: {} };
      autoSupplementedToolCall = true;
    }

    // 双重保护：即使 parseEveOutput 放行了 toolCall，
    // route 层仍校验 temptationProgress >= 2 + phase + isEnded + hasEatenFruit
    if (effectiveToolCall && state.phase === "dialogue" && !state.isEnded) {
      state.eventLog.push(
        makeEvent("tool_request", state.turn, `夏娃向树上的果子伸出了手。`),
      );

      const validation = validateToolCall(state, effectiveToolCall);

      if (validation.allowed) {
        // 确保对白与吃果行为一致：
        // - 如果模型自己输出了 toolCall，仍检查对白是否矛盾
        // - 如果是自动补的 toolCall，几乎肯定需要修正对白
        eveReply = normalizeEveReplyForToolCall(eveReply, localAnalysis.isStrongTemptation);

        const { state: newState } = executeEatFruit(state);

        return NextResponse.json({
          ok: true,
          state: newState,
          eveReply,
          systemHint: null,
          feedbackText,
          inputTag: localAnalysis.inputTag,
          usedFallback: agentResult.usedFallback || undefined,
          fallbackReason: agentResult.fallbackReason || undefined,
          usage: agentResult.usage || undefined,
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
        feedbackText,
        inputTag: localAnalysis.inputTag,
        usedFallback: agentResult.usedFallback || undefined,
        fallbackReason: agentResult.fallbackReason || undefined,
        usage: agentResult.usage || undefined,
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
      feedbackText,
      inputTag: localAnalysis.inputTag,
      usedFallback: agentResult.usedFallback || undefined,
      fallbackReason: agentResult.fallbackReason || undefined,
      usage: agentResult.usage || undefined,
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
