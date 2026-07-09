// ============================================================
// 第一章神的注视规则层
//
// 神的注视（0-4，满 4 触发神明献礼并归零）。
// 第 12 时段结束仍未吃果是唯一失败条件。
//
// 风险来源：
// - 直接命令 / 威胁强迫 → 大幅提升
// - 出戏现代词 → 提升
// - 在天使所在区域诱导 → 提升
// - 过度重复同一诱导 → 小幅提升
// - 在树庭院进行禁忌动作 → 提升
// - 温柔提问 → 不提升或极小
// ============================================================

import type {
  EdenWorldState,
  DivineAttentionLevel,
} from "@/game/world/types";
import { DIVINE_ATTENTION_NARRATIONS } from "@/game/world/types";
import type { WorldInputTag, WorldToolName } from "@/game/world/types";

/** 计算神的注视增量（基于玩家输入，不含工具副作用） */
export function computeDivineAttentionDelta(params: {
  inputTag: WorldInputTag;
  locationId: EdenWorldState["locationId"];
  angelLocation: EdenWorldState["npcLocations"]["watching_angel"];
  isStrongTemptation: boolean;
  divineAttention: DivineAttentionLevel;
}): number {
  const { inputTag, locationId, angelLocation, isStrongTemptation, divineAttention } = params;

  let delta = 0;

  // 直接命令 → 大幅提升
  if (inputTag === "direct_command") {
    delta += 2;
  }

  // 出戏 → 提升
  if (inputTag === "irrelevant") {
    delta += 1;
  }

  // 在天使所在区域诱导 → 提升（天使在树庭院巡望，那里更危险）
  if (locationId === angelLocation && inputTag !== "irrelevant") {
    delta += 1;
  }

  // 强诱导在天使所在区域 → 额外提升（天使巡望区更危险）
  if (isStrongTemptation && locationId === angelLocation) {
    delta += 1;
  }

  // 注：look_at_tree / approach_tree 不再单独提升神的注视，
  //     它们是"看"和"走"，不是越界本身；
  //     touch_fruit 的风险由 route.ts 在工具执行后单独补加。
  // 注：移除"divineAttention >= 3 且 tempt 时再 +1"的升级规则，
  //     避免正向诱导在成功链路末段被误判为失败。

  return delta;
}

/** 工具执行后补加的神的注视（仅 touch_fruit，手停在果子下方是真正的越界前兆） */
export function computeToolDivineAttentionDelta(triggeredTool: WorldToolName | undefined): number {
  if (triggeredTool === "touch_fruit") return 1;
  return 0;
}

/** 应用神的注视变化，返回新等级（clamp 0-4） */
export function applyDivineAttention(
  current: DivineAttentionLevel,
  delta: number,
): DivineAttentionLevel {
  const next = Math.max(0, Math.min(4, current + delta));
  return next as DivineAttentionLevel;
}

/** 获取神的注视叙事 */
export function getDivineAttentionNarration(level: DivineAttentionLevel): string {
  return DIVINE_ATTENTION_NARRATIONS[level];
}

/** 判断是否触发失败结局（第12时段结束仍未吃果） */
export function shouldTriggerGodArrives(state: EdenWorldState): boolean {
  if (state.isEnded) return false;
  // 第12时段结束仍未吃果，才触发失败
  return state.timeSlot >= 12 && !state.worldActions.hasEatenFruit;
}
