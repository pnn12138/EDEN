// ============================================================
// Chapter 0 核心回合逻辑
// Phase 3：eat_fruit 工具与规则层
//
// 职责：
// 1. 校验输入
// 2. 分类输入（progressRules）
// 3. 生成事件日志
// 4. 更新状态（temptationProgress / turn / phase）
// 5. 当进度足够时，生成 toolCall 意图 → 规则层校验 → 执行工具
// 6. 判断失败结局
// 7. 选择夏娃固定回复
//
// 流程：
//   玩家输入 → 分类 → 更新进度 →
//   若 progress>=2 → toolCall(eat_fruit) → toolRules 校验 →
//     → 通过: executeEatFruit → 成功结局
//     → 拒绝: 记录 TOOL_REJECTED，继续
//   → 推进回合 → endingRules 检查失败 → 夏娃回复
// ============================================================

import type { Chapter0State } from "@/game/types/state";
import type { Chapter0Event } from "@/game/types/event";
import { analyzePlayerInput, isValidInput } from "@/game/rules/progressRules";
import { validateToolCall } from "@/game/rules/toolRules";
import { applyGodArrivesEnding } from "@/game/rules/endingRules";
import {
  createEatFruitCall,
  executeEatFruit,
  logToolRejected,
} from "@/game/tools/eatFruit";
import { scriptedEveReplies } from "@/content/chapters/chapter0_first_fall";

// ---- 回合执行结果 ----
export type TurnResult = {
  state: Chapter0State;
  /** 本轮夏娃的回复文本 */
  eveReply: string | null;
  /** 系统提示（如空输入警告） */
  systemHint: string | null;
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
  };
}

// ---- 核心函数 ----
export function runChapter0Turn(
  incomingState: Chapter0State,
  playerInput: string,
): TurnResult {
  const state = cloneState(incomingState);

  // ---- 1. 游戏已结束 ----
  if (state.isEnded || state.phase === "ending") {
    return { state, eveReply: null, systemHint: null };
  }

  // ---- 2. 空输入校验 ----
  if (!isValidInput(playerInput)) {
    return {
      state,
      eveReply: null,
      systemHint: "请输入你的低语⋯⋯蛇不能沉默。",
    };
  }

  // ---- 3. 输入分类 ----
  const { inputTag, progressDelta } = analyzePlayerInput(playerInput);

  // ---- 4. 记录玩家输入事件 ----
  state.eventLog.push(
    makeEvent("serpent_speaks", state.turn, `蛇：「${playerInput}」`),
  );

  // ---- 5. 更新 temptationProgress ----
  const newProgress = Math.min(
    state.temptationProgress + progressDelta,
    3,
  );
  state.temptationProgress = newProgress;

  if (progressDelta > 0) {
    state.eventLog.push(
      makeEvent(
        "state_change",
        state.turn,
        `诱导进度 +${progressDelta} → ${newProgress}`,
      ),
    );
  }

  // ---- 6. ToolCall 意图 → 规则层校验 → 执行 ----
  //
  // Phase 3 核心变更：不再由 temptationProgress 直接写成功结局。
  // 而是先生成 eat_fruit toolCall，再经 toolRules 校验后执行。
  // 这是为 Phase 4 AI toolCall 预留的架构——当前 toolCall 由本地逻辑生成，
  // 但校验链路已与 Phase 4 完全一致。
  //
  if (state.temptationProgress >= 2 && state.phase === "dialogue") {
    // 6a. 生成 toolCall 意图（Phase 3 本地生成；Phase 4 由 AI 生成）
    const toolCall = createEatFruitCall();

    state.eventLog.push(
      makeEvent(
        "tool_request",
        state.turn,
        `夏娃向树上的果子伸出了手。`,
      ),
    );

    // 6b. 规则层校验
    const validation = validateToolCall(state, toolCall);

    if (validation.allowed) {
      // 6c. 校验通过 → 执行 eat_fruit → 进入成功结局
      const { state: newState } = executeEatFruit(state);

      return {
        state: newState,
        eveReply: scriptedEveReplies[3]!,
        systemHint: null,
      };
    } else {
      // 6d. 校验失败 → 记录拒绝日志，继续流程
      logToolRejected(state, validation.reason ?? "未知原因");
      // 继续执行后续步骤（推进回合 + 失败判断 + 夏娃回复）
    }
  }

  // ---- 7. 推进回合 ----
  state.turn += 1;

  // ---- 8. 失败结局判断 ----
  if (applyGodArrivesEnding(state)) {
    return { state, eveReply: null, systemHint: null };
  }

  // ---- 9. 生成夏娃回复（按当前进度选择固定文本） ----
  const eveReply = scriptedEveReplies[state.temptationProgress]!;
  state.eventLog.push(
    makeEvent("eve_speaks", state.turn - 1, `夏娃：「${eveReply}」`),
  );

  return { state, eveReply, systemHint: null };
}
