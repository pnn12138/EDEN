// ============================================================
// 第一章轻量 NPC 时段行动结算
//
// 不做完整 NPC 自主规划器。每次时段推进时做规则化结算：
// - 神的注视升高时，刺猬/小鹿警觉或躲藏
// - 夜晚伊甸之河出现天使边界提示
// - 后期女人心智达标时，可被规则推进到园子中央
//
// NPC 行动只做叙事和轻量状态影响，不抢玩家控制权。
// ============================================================

import type { EdenWorldState, EdenNpcId } from "@/game/world/types";

export type NpcSlotResolution = {
  npcId: EdenNpcId;
  /** 玩家可见叙事 */
  narration: string;
};

/**
 * 每次时段推进时结算 NPC 行为。
 * 返回玩家可见的叙事列表（轻量状态影响已直接写入 state）。
 */
export function resolveNpcSlotBehaviors(state: EdenWorldState): NpcSlotResolution[] {
  const resolutions: NpcSlotResolution[] = [];
  const maxNpcActions = state.maxNpcActionPoints ?? 3;
  let remainingNpcActions = Math.min(state.npcActionPoints ?? maxNpcActions, maxNpcActions);

  function pushResolution(resolution: NpcSlotResolution): void {
    if (remainingNpcActions <= 0) return;
    resolutions.push(resolution);
    remainingNpcActions -= 1;
    state.npcActionPoints = remainingNpcActions;
  }

  // 1. 神的注视升高时，刺猬/小鹿警觉或躲藏
  if (state.divineAttention >= 3) {
    state.hedgehog.mood = "hiding";
    pushResolution({
      npcId: "hedgehog",
      narration: "万物受名处的草丛里，刺猬缩成一团，刺都竖起来了。它感觉到了风里的东西。",
    });
  } else if (state.divineAttention >= 2) {
    state.hedgehog.mood = "alert";
    pushResolution({
      npcId: "hedgehog",
      narration: "刺猬停住了，转过身看着远处。它的鼻子一动一动，像在分辨什么声音。",
    });
  } else {
    state.hedgehog.mood = "idle";
  }

  // 2. 夜晚伊甸之河：天使边界提示
  if (state.timeOfDay === "night" && state.locationId === "four_river_source") {
    pushResolution({
      npcId: "gabriel",
      narration: "伊甸之河的水边，天使的影子在月光下更清楚了。它没有说话，但它的存在让这里比别处更被注视。",
    });
  }

  // 3. 后期女人心智达标时，可被规则推进到园子中央
  //    条件：timeSlot >= 9 且女人好奇心高且已看过树，但尚未靠近
  if (
    state.timeSlot >= 9 &&
    state.eveMind.selfJudgement >= 55 &&
    state.worldActions.lookedAtTree &&
    !state.worldActions.approachedTree &&
    state.npcLocations.eve !== "central_meadow"
  ) {
    state.npcLocations.eve = "central_meadow";
    pushResolution({
      npcId: "eve",
      narration: "夜深了，那个女人自己走向园子中央。她没有看蛇，只是被那棵树牵着走。",
    });
  }

  state.npcActionPoints = remainingNpcActions;
  return resolutions;
}
