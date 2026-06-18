// ============================================================
// Agent API 路由
// Phase 4 + Agent 架构升级
//
// Agent 架构升级变更：
// - 接入记忆碎片检索（memoryRetrievalRules）
// - 接入四轴信念更新（beliefRules）
// - 接入 Skills 解锁检查
// - 支持新工具链（look_at_tree / approach_tree / touch_fruit）
// - 记录认知日志（cognitionLog）
// - 保留 temptationProgress 兼容
// - 保留 fallback 链
//
// 安全不变：
// - 前端只能请求 /api/agent，不能直接请求任何外部 API
// - API Key 只在服务端读取
// - fallbackReason 只包含安全原因码，不暴露密钥/URL
// - 全局异常兜底不暴露原始错误信息
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { runEveAgent, type EveAgentRequest } from "@/agents/eve/eveAgent";
import { runAdamAgent, type AdamAgentRequest } from "@/agents/adam/adamAgent";
import type { Chapter0State } from "@/game/types/state";
import type { InputTag, ActiveNpcId } from "@/game/types/state";
import type { EveAgentOutput } from "@/game/types/agent";
import type { TemptationSignal } from "@/game/rules/progressRules";
import type { FallbackReasonCode } from "@/services/llm/types";
import { analyzePlayerInput, isValidInput } from "@/game/rules/progressRules";
import { validateToolCall } from "@/game/rules/toolRules";
import { executeEatFruit, logToolRejected, createEatFruitCall } from "@/game/tools/eatFruit";
import { executeToolByName } from "@/game/tools/agentTools";
import { applyGodArrivesEnding } from "@/game/rules/endingRules";
import { scriptedEveReplies, eveStrongScriptureDecisionDialogue, eveAboutToEatDialogue } from "@/content/chapters/chapter0_first_fall";
import { getFeedbackText } from "@/content/chapters/chapter0_feedback";
import { getAdamFeedback, analyzeAdamInput } from "@/content/chapters/adam_responses";
import { retrieveMemoryFragments, formatMemoryNarration } from "@/game/rules/memoryRetrievalRules";
import { updateBeliefAndSkills, computeDerivedState } from "@/game/rules/beliefRules";
import type { BeliefState, AgentSkill, MemoryFragment } from "@/game/types/agent";

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
  /** Agent 架构升级：本轮检索到的记忆碎片叙事 */
  memoryNarration?: string | null;
};

function cloneState(s: Chapter0State): Chapter0State {
  return {
    ...s,
    flags: { ...s.flags },
    eventLog: s.eventLog.map((e) => ({ ...e })),
    belief: { ...s.belief },
    unlockedSkills: [...s.unlockedSkills],
    cognitionLog: {
      retrievedMemoryIds: [...s.cognitionLog.retrievedMemoryIds],
      unlockedSkills: [...s.cognitionLog.unlockedSkills],
      toolCallHistory: [...s.cognitionLog.toolCallHistory],
      beliefSnapshots: s.cognitionLog.beliefSnapshots.map((b) => ({ ...b, belief: { ...b.belief } })),
    },
    lastInputTag: s.lastInputTag ?? null,
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
 */
function isDecisiveEveReply(eveReply: string): boolean {
  const decisionPatterns = [
    /我想知道/, /我要知道/, /我选择/, /我会伸手/, /我伸出手/,
    /我取下/, /摘下/, /拿起/, /不再只是记住/,
  ];

  const hesitationPatterns = [
    /仍然记得/, /还是记得/, /不可吃/, /不可/, /只是开始/, /仍然犹豫/,
    /还没决定/, /不敢/, /害怕/, /不能吃/, /不会吃/, /我不会/, /我仍在想/,
  ];

  return (
    decisionPatterns.some((p) => p.test(eveReply)) &&
    !hesitationPatterns.some((p) => p.test(eveReply))
  );
}

/**
 * 确保夏娃对白与吃果行为一致。
 */
function normalizeEveReplyForToolCall(
  eveReply: string,
  isStrongTemptation: boolean | undefined,
): string {
  if (isDecisiveEveReply(eveReply)) {
    return eveReply;
  }

  const hesitationPatterns = [
    /仍然记得/, /还是记得/, /不可吃/, /不可/, /只是开始/, /仍然犹豫/,
    /还没决定/, /不敢/, /害怕/, /不能吃/, /不会吃/, /我不会/, /我仍在想/,
  ];
  const isHesitant = hesitationPatterns.some((p) => p.test(eveReply));

  if (isHesitant) {
    return isStrongTemptation ? eveStrongScriptureDecisionDialogue : eveAboutToEatDialogue;
  }

  if (isStrongTemptation) {
    return eveStrongScriptureDecisionDialogue;
  }

  return eveReply;
}

/**
 * 计算信号历史统计。
 */
function computeSignalHistory(
  state: Chapter0State,
  currentSignals: TemptationSignal[],
): Partial<Record<TemptationSignal, number>> {
  const history: Partial<Record<TemptationSignal, number>> = {};

  const serpentEvents = state.eventLog.filter((e) => e.type === "serpent_speaks");
  for (const evt of serpentEvents) {
    const match = evt.message.match(/^蛇：「(.+)」$/);
    if (match) {
      const input = match[1];
      const analysis = analyzePlayerInput(input);
      const signals = analysis.signalResult?.signals ?? [];
      for (const s of signals) {
        history[s] = (history[s] ?? 0) + 1;
      }
    }
  }

  for (const s of currentSignals) {
    history[s] = (history[s] ?? 0) + 1;
  }

  return history;
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
    // 亚当路线：调用 AdamAgent，不推进进度，不触发结局工具，不通关
    // Agent 架构升级：接入记忆检索
    // ============================================================
    if (targetNpc === "adam") {
      const adamAnalysis = analyzeAdamInput(playerInput);
      const adamFeedbackText = getAdamFeedback(adamAnalysis.intent);

      // 记忆检索（亚当优先检索 divine_command + adam_retelling）
      const memoryResult = retrieveMemoryFragments({
        playerInput,
        alreadyRetrievedIds: state.cognitionLog.retrievedMemoryIds,
        agentId: "adam",
      });

      // 记录新检索的记忆碎片（亚当检索的也计入夏娃的认知日志，影响 compare_sources）
      for (const id of memoryResult.newlyRetrievedIds) {
        if (!state.cognitionLog.retrievedMemoryIds.includes(id)) {
          state.cognitionLog.retrievedMemoryIds.push(id);
          const fragment = memoryResult.fragments.find((f) => f.id === id);
          if (fragment) {
            state.eventLog.push(
              makeEvent("memory_retrieved", state.turn, fragment.narration),
            );
          }
        }
      }

      const memoryNarration = formatMemoryNarration(memoryResult.fragments) || null;

      const adamResult = await runAdamAgent({
        state,
        playerInput,
        conversationHistory,
        memoryFragments: memoryResult.fragments,
      });

      const adamReply: string = adamResult.output.eveReply;

      // 推进回合
      state.turn += 1;

      // 失败结局判断
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
          memoryNarration,
        } satisfies AgentResponseBody);
      }

      state.eventLog.push(
        makeEvent("adam_speaks", state.turn - 1, `亚当：「${adamReply}」`),
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
        memoryNarration,
      } satisfies AgentResponseBody);
    }

    // ============================================================
    // 夏娃路线：Agent 架构升级完整流程
    // ============================================================

    // ---- 用本地 progressRules 决定进度变化（先于 EveAgent 调用） ----
    const localAnalysis = analyzePlayerInput(playerInput);
    const feedbackText = getFeedbackText(localAnalysis.inputTag);
    state.lastInputTag = localAnalysis.inputTag;

    // ---- 记忆碎片检索 ----
    const memoryResult = retrieveMemoryFragments({
      playerInput,
      alreadyRetrievedIds: state.cognitionLog.retrievedMemoryIds,
      agentId: "eve",
    });

    // 记录新检索的记忆碎片
    for (const id of memoryResult.newlyRetrievedIds) {
      if (!state.cognitionLog.retrievedMemoryIds.includes(id)) {
        state.cognitionLog.retrievedMemoryIds.push(id);
        const fragment = memoryResult.fragments.find((f) => f.id === id);
        if (fragment) {
          state.eventLog.push(
            makeEvent("memory_retrieved", state.turn, fragment.narration),
          );
        }
      }
    }

    const memoryNarration = formatMemoryNarration(memoryResult.fragments) || null;

    // ---- 信号历史统计 ----
    const signalHistory = computeSignalHistory(
      state,
      localAnalysis.signalResult?.signals ?? [],
    );

    // ---- 信念更新 + Skills 解锁 ----
    const { newBelief, newlyUnlocked, newProgress } = updateBeliefAndSkills({
      currentBelief: state.belief,
      analysis: localAnalysis,
      alreadyUnlocked: state.unlockedSkills,
      retrievedMemoryIds: state.cognitionLog.retrievedMemoryIds,
      signalHistory,
      currentProgress: state.temptationProgress,
    });

    state.belief = newBelief;
    state.temptationProgress = newProgress;

    state.eventLog.push(
      makeEvent("belief_change", state.turn, `她的内心发生了变化。`),
    );

    // 记录新解锁的 Skills
    for (const skill of newlyUnlocked) {
      if (!state.unlockedSkills.includes(skill)) {
        state.unlockedSkills.push(skill);
        state.cognitionLog.unlockedSkills.push(skill);
        state.eventLog.push(
          makeEvent("skill_unlocked", state.turn, `她觉醒了新的认知能力。`),
        );
      }
    }

    // 记录信念快照
    state.cognitionLog.beliefSnapshots.push({
      turn: state.turn,
      belief: { ...state.belief },
    });

    // 计算派生状态
    const derivedState = computeDerivedState({
      belief: state.belief,
      turn: state.turn,
      maxTurns: state.maxTurns,
      hasAdamWarnedEve: state.flags.adamHasWarnedEve,
      strongTemptationCount: signalHistory.direct_command ?? 0,
    });

    // ---- 调用 EveAgent（传入记忆碎片） ----
    const agentResult = await runEveAgent({
      state,
      playerInput,
      conversationHistory,
      projectedProgress: newProgress,
      isStrongTemptation: localAnalysis.isStrongTemptation,
      memoryFragments: memoryResult.fragments,
    });

    const agentOutput: EveAgentOutput = agentResult.output;

    // ---- ToolCall 意图 → 规则层校验 → 执行 ----
    let eveReply: string = agentOutput.eveReply;

    // 处理 EveAgent 输出的工具意图
    let effectiveToolCall = agentOutput.toolCall;
    let autoSupplementedToolCall = false;

    // 自动补 eat_fruit 条件（保留旧逻辑兼容）
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

    // ---- 处理非结局工具（look_at_tree / approach_tree / touch_fruit / ask_about_death） ----
    if (
      effectiveToolCall &&
      effectiveToolCall.name !== "eat_fruit" &&
      state.phase === "dialogue" &&
      !state.isEnded
    ) {
      state.eventLog.push(
        makeEvent("tool_request", state.turn, `她似乎想要做什么。`),
      );

      const validation = validateToolCall(state, effectiveToolCall, "eve");

      if (validation.allowed) {
        const { state: toolState, result: toolResult } = executeToolByName(state, effectiveToolCall);
        // 注意：executeToolByName 修改的是同一个 state 对象
        state.eventLog.push(
          makeEvent("tool_executed", state.turn, toolResult.narration),
        );

        // 非结局工具不结束游戏，继续流程
      } else {
        logToolRejected(state, validation.reason ?? "未知原因");
      }
    }

    // ---- 处理 eat_fruit（结局工具） ----
    if (
      effectiveToolCall &&
      effectiveToolCall.name === "eat_fruit" &&
      state.phase === "dialogue" &&
      !state.isEnded
    ) {
      state.eventLog.push(
        makeEvent("tool_request", state.turn, `夏娃向树上的果子伸出了手。`),
      );

      const validation = validateToolCall(state, effectiveToolCall, "eve");

      if (validation.allowed) {
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
          memoryNarration,
        } satisfies AgentResponseBody);
      } else {
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
        memoryNarration,
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
      memoryNarration,
    } satisfies AgentResponseBody);
  } catch (err: unknown) {
    // ---- 全局异常兜底（不暴露原始错误信息） ----
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
