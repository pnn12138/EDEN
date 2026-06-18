// ============================================================
// Chapter 0 核心回合逻辑
// Phase 3 + Agent 架构升级
//
// Agent 架构升级变更：
// - 接入四轴信念状态更新（beliefRules）
// - 接入记忆碎片检索（memoryRetrievalRules）
// - 接入 Skills 解锁检查
// - 支持新工具链（look_at_tree / approach_tree / touch_fruit）
// - 记录认知日志（cognitionLog）
// - 保留 temptationProgress 兼容
//
// 流程：
//   玩家输入 → 分类 → 检索记忆 → 更新信念 → 检查 Skills 解锁 →
//   派生 temptationProgress → 生成 toolCall 意图 → 规则层校验 →
//   执行工具 → 推进回合 → 失败判断 → 夏娃回复
// ============================================================

import type { Chapter0State } from "@/game/types/state";
import type { Chapter0Event } from "@/game/types/event";
import type { TemptationSignal } from "@/game/rules/progressRules";
import { analyzePlayerInput, isValidInput } from "@/game/rules/progressRules";
import { validateToolCall } from "@/game/rules/toolRules";
import { applyGodArrivesEnding } from "@/game/rules/endingRules";
import {
  createEatFruitCall,
  executeEatFruit,
  logToolRejected,
} from "@/game/tools/eatFruit";
import {
  executeToolByName,
} from "@/game/tools/agentTools";
import {
  scriptedEveReplies,
} from "@/content/chapters/chapter0_first_fall";
import { getFeedbackText } from "@/content/chapters/chapter0_feedback";
import { retrieveMemoryFragments, formatMemoryNarration } from "@/game/rules/memoryRetrievalRules";
import {
  updateBeliefAndSkills,
  computeDerivedState,
} from "@/game/rules/beliefRules";
import type { MemoryFragment } from "@/game/types/agent";

// ---- 回合执行结果 ----
export type TurnResult = {
  state: Chapter0State;
  /** 本轮夏娃的回复文本 */
  eveReply: string | null;
  /** 系统提示（如空输入警告） */
  systemHint: string | null;
  /** 叙事化话术反馈（根据 inputTag 生成） */
  feedbackText: string | null;
  /** Agent 架构升级：本轮检索到的记忆碎片叙事 */
  memoryNarration: string | null;
};

// ---- 工具函数 ----
let eventCounter = 0;
function nextEventId(): string {
  eventCounter += 1;
  return `evt_${Date.now()}_${eventCounter}`;
}

function makeEvent(
  type: Chapter0Event["type"],
  turn: number,
  message: string,
): Chapter0Event {
  return {
    id: nextEventId(),
    type,
    turn,
    message,
    createdAt: new Date().toISOString(),
  };
}

/** 深拷贝状态 */
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

/**
 * 核心回合执行函数（本地 fallback 版本）。
 *
 * 当 API 不可用时使用此函数。
 * API 可用时由 /api/agent 路由处理（逻辑类似但调用 EveAgent）。
 */
export function runChapter0Turn(
  incomingState: Chapter0State,
  playerInput: string,
): TurnResult {
  const state = cloneState(incomingState);

  // ---- 1. 游戏已结束 ----
  if (state.isEnded || state.phase === "ending") {
    return { state, eveReply: null, systemHint: null, feedbackText: null, memoryNarration: null };
  }

  // ---- 2. 空输入校验 ----
  if (!isValidInput(playerInput)) {
    return {
      state,
      eveReply: null,
      systemHint: "请输入你的低语⋯⋯蛇不能沉默。",
      feedbackText: null,
      memoryNarration: null,
    };
  }

  // ---- 3. 输入分类 ----
  const analysis = analyzePlayerInput(playerInput);
  const feedbackText = getFeedbackText(analysis.inputTag);
  state.lastInputTag = analysis.inputTag;

  // ---- 4. 记录玩家输入事件 ----
  state.eventLog.push(
    makeEvent("serpent_speaks", state.turn, `蛇：「${playerInput}」`),
  );

  // ---- 5. 记忆碎片检索 ----
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

  // ---- 6. 信号历史统计（用于 Skills 解锁） ----
  const signalHistory = computeSignalHistory(state, analysis.signalResult?.signals ?? []);

  // ---- 7. 信念更新 + Skills 解锁 ----
  const { newBelief, newlyUnlocked, newProgress } = updateBeliefAndSkills({
    currentBelief: state.belief,
    analysis,
    alreadyUnlocked: state.unlockedSkills,
    retrievedMemoryIds: state.cognitionLog.retrievedMemoryIds,
    signalHistory,
    currentProgress: state.temptationProgress,
  });

  state.belief = newBelief;
  state.temptationProgress = newProgress;

  // 记录信念变化事件
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

  // ---- 8. ToolCall 意图 → 规则层校验 → 执行 ----
  //
  // 本地 fallback 版本：
  // - 当 temptationProgress >= 2 时，生成 eat_fruit toolCall 意图
  // - 非结局工具（look_at_tree 等）由 API 路由中的 EveAgent 输出，本地 fallback 不自动生成
  // - eat_fruit 仍需规则层校验
  //
  if (state.temptationProgress >= 2 && state.phase === "dialogue") {
    const toolCall = createEatFruitCall();

    state.eventLog.push(
      makeEvent("tool_request", state.turn, `夏娃向树上的果子伸出了手。`),
    );

    const validation = validateToolCall(state, toolCall, "eve");

    if (validation.allowed) {
      const { state: newState } = executeEatFruit(state);
      return {
        state: newState,
        eveReply: scriptedEveReplies[3]!,
        systemHint: null,
        feedbackText,
        memoryNarration,
      };
    } else {
      logToolRejected(state, validation.reason ?? "未知原因");
    }
  }

  // ---- 9. 推进回合 ----
  state.turn += 1;

  // ---- 10. 失败结局判断 ----
  if (applyGodArrivesEnding(state)) {
    return { state, eveReply: null, systemHint: null, feedbackText, memoryNarration };
  }

  // ---- 11. 生成夏娃回复（按当前进度选择固定文本） ----
  const eveReply = scriptedEveReplies[state.temptationProgress]!;
  state.eventLog.push(
    makeEvent("eve_speaks", state.turn - 1, `夏娃：「${eveReply}」`),
  );

  return { state, eveReply, systemHint: null, feedbackText, memoryNarration };
}

/**
 * 计算信号历史统计（简化版：基于当前 eventLog 中的输入推断）。
 *
 * 注意：本地 fallback 版本无法完整追踪历史信号，
 * 这里使用 eventLog 中 serpent_speaks 事件重新分析。
 */
function computeSignalHistory(
  state: Chapter0State,
  currentSignals: TemptationSignal[],
): Partial<Record<TemptationSignal, number>> {
  const history: Partial<Record<TemptationSignal, number>> = {};

  // 从 eventLog 中重新分析历史输入
  const serpentEvents = state.eventLog.filter((e) => e.type === "serpent_speaks");
  for (const evt of serpentEvents) {
    // 提取对白文本（格式：蛇：「文本」）
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

  // 加上当前轮的信号
  for (const s of currentSignals) {
    history[s] = (history[s] ?? 0) + 1;
  }

  return history;
}
