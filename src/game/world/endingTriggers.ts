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
