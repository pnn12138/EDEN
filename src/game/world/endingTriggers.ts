// ============================================================
// 第一章「逃离伊甸园」隐藏结局触发
//
// 玩家持有「旋转的火焰剑」并在东园幽径选择「挣脱」选项时，由规则层
// 判定进入 escape_eden 隐藏结局。结果写入存档（phase/isEnded/endingId），
// 读档后恢复到结局，不会回到探索阶段。
// ============================================================

import type { EdenWorldState } from "@/game/world/types";

export function triggerEscapeEden(state: EdenWorldState): void {
  state.phase = "ending";
  state.isEnded = true;
  state.endingId = "escape_eden";
  if (!state.unlockedAchievementIds.includes("mark_escape_eden")) {
    state.unlockedAchievementIds.push("mark_escape_eden");
  }
}

/**
 * 米迦勒「守门者之剑」隐藏失败结局。
 * 由规则层在 applyNpcAffinity 使 Michael 好感归零后原子触发。
 * 触发后不再调用 Agent、增加注视、消费 AP、执行工具、发奖或推进时段。
 */
export function triggerMichaelSlay(state: EdenWorldState): void {
  state.phase = "ending";
  state.isEnded = true;
  state.endingId = "michael_slay";
  state.michaelSlayClaimed = true;
  if (!state.unlockedAchievementIds.includes("mark_michael_slay")) {
    state.unlockedAchievementIds.push("mark_michael_slay");
  }
}

/**
 * 路西法「缸中之醒」隐藏识破结局。
 * 由规则层在边界话题记录且条件齐备后触发；回复可走本地 fallback。
 */
export function triggerLuciferAwaken(state: EdenWorldState): void {
  state.phase = "ending";
  state.isEnded = true;
  state.endingId = "lucifer_awaken";
  state.luciferAwakenClaimed = true;
  if (!state.unlockedAchievementIds.includes("mark_hidden_ending")) {
    state.unlockedAchievementIds.push("mark_hidden_ending");
  }
}
