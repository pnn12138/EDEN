// ============================================================
// 第一章刺猬环境反馈规则
//
// 刺猬延续 Chapter 0 的温和、害羞、环境反馈定位。
// 不提供通关答案，不修改结局门槛，不消耗回合。
// 根据神的注视、地点、夏娃是否靠近树切换心境。
// ============================================================

import type {
  EdenWorldState,
  HedgehogMood,
} from "@/game/world/types";
import { getHedgehogWorldFeedback } from "@/content/world/worldNarrations";

/**
 * 根据世界状态计算刺猬的心境。
 *
 * 规则：
 * - divineAttention >= 3 → hiding（神临近，刺猬躲藏）
 * - 夏娃已 approach_tree → alert（刺猬停住看向树）
 * - 玩家在万物受名处或伊甸之河 → curious（刺猬好奇探出头）
 * - 否则 → idle
 *
 * 刺猬主活动区是万物受名处（亚当为动物命名的草甸），
 * 也可在伊甸之河附近短暂出现；四河分流不再作为刺猬主活动区。
 */
export function computeHedgehogWorldMood(state: EdenWorldState): HedgehogMood {
  if (state.divineAttention >= 3) return "hiding";
  // 神的注视升到 2：刺猬察觉到不对的气味，切到 alert（先于靠近树的 alert）
  if (state.divineAttention >= 2) return "alert";
  if (state.worldActions.approachedTree) return "alert";

  const safeLocations = ["adam_garden_work", "four_river_source"];
  if (safeLocations.includes(state.locationId) && state.divineAttention <= 1) {
    return "curious";
  }

  return "idle";
}

/** 获取刺猬的叙事反馈 */
export function getHedgehogWorldNarration(state: EdenWorldState): string {
  const mood = computeHedgehogWorldMood(state);
  // 因神的注视升到 2 而警觉时，给出专属叙事（不复用靠近树的台词）
  if (mood === "alert" && state.divineAttention >= 2 && !state.worldActions.approachedTree) {
    return "刺猬竖起了刺，风里有不对的气味。";
  }
  const feedback = getHedgehogWorldFeedback(mood, state.hedgehog.locationId);
  return feedback.narration;
}

/** 获取刺猬 CSS 类名（供前端使用） */
export function getHedgehogWorldCssClass(mood: HedgehogMood): string {
  switch (mood) {
    case "hiding":
      return "eden-hedgehog--hiding";
    case "alert":
      return "eden-hedgehog--alert";
    case "curious":
      return "eden-hedgehog--curious";
    default:
      return "eden-hedgehog--idle";
  }
}
