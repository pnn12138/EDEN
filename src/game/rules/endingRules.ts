// ============================================================
// 结局触发规则
// Phase 3：eat_fruit 工具与规则层
//
// 职责：
// 1. 判断失败结局条件
// 2. 应用结局状态修改
// 3. 确保每个结局只触发一次
// ============================================================

import type { Chapter0State } from "@/game/types/state";
import type { Chapter0Event } from "@/game/types/event";

// ---- 事件工具 ----
let endingEventCounter = 0;
function nextId(): string {
  endingEventCounter += 1;
  return `evt_end_${Date.now()}_${endingEventCounter}`;
}

function makeEvent(
  type: Chapter0Event["type"],
  turn: number,
  message: string,
): Chapter0Event {
  return { id: nextId(), type, turn, message, createdAt: new Date().toISOString() };
}

// ---- 失败结局 ----

/**
 * 检查并应用失败结局（god_arrives）。
 *
 * 条件：
 * - turn > maxTurns（超过回合上限）
 * - !flags.hasEatenFruit（尚未吃果子）
 * - !isEnded（游戏尚未因其他结局结束）
 *
 * 应用后：
 * - flags.godHasArrived = true
 * - isEnded = true
 * - endingId = "god_arrives"
 * - phase = "ending"
 *
 * @returns true 表示已应用失败结局
 */
export function applyGodArrivesEnding(state: Chapter0State): boolean {
  // 条件检查：超过回合上限且未吃果子且未结束
  if (
    state.turn > state.maxTurns &&
    !state.flags.hasEatenFruit &&
    !state.isEnded
  ) {
    state.flags.godHasArrived = true;
    state.isEnded = true;
    state.endingId = "god_arrives";
    state.phase = "ending";

    state.eventLog.push(
      makeEvent("ending", state.turn - 1, "结局：神降临了"),
    );

    return true;
  }

  return false;
}

/**
 * 纯查询：当前状态是否满足失败结局条件。
 * 不做任何状态修改。
 */
export function shouldTriggerGodArrives(state: Chapter0State): boolean {
  return (
    state.turn > state.maxTurns &&
    !state.flags.hasEatenFruit &&
    !state.isEnded
  );
}
