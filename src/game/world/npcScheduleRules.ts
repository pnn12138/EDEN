// ============================================================
// 第一章轻量 NPC 时段行动结算
//
// 不做完整 NPC 自主规划器。每次时段推进时做规则化结算：
// - 神的注视升高时，刺猬警觉或躲藏
// - 夜晚伊甸之河出现天使边界提示
// - 本轮被低语过的女人/亚当，可在时段结束时选择移动一格
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
  const spokenNpcIds = new Set<EdenNpcId>(state.actionsThisSlot?.whisperedNpcIds ?? []);

  function pushResolution(resolution: NpcSlotResolution): void {
    if (remainingNpcActions <= 0) return;
    resolutions.push(resolution);
    remainingNpcActions -= 1;
    state.npcActionPoints = remainingNpcActions;
  }

  // 1. 神的注视升高时，刺猬警觉或躲藏（情绪变化，不移动）
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

  // 2. 夜晚伊甸之河：天使边界提示（提示，不移动）
  if (state.timeOfDay === "night" && state.locationId === "four_river_source") {
    pushResolution({
      npcId: "gabriel",
      narration: "伊甸之河的水边，天使的影子在月光下更清楚了。它没有说话，但它的存在让这里比别处更被注视。",
    });
  }

  // 3. 只有本轮被低语过的 NPC，才会在时段结束时考虑移动。
  //    女人只在「园中树林 / 园子中央 / 万物受名处」之间移动；
  //    每次最多移动一格，避免玩家找不到她。
  if (spokenNpcIds.has("eve") && !state.isEnded) {
    if (
      state.npcLocations.eve === "tree_court" &&
      (state.eveMind.selfJudgement >= 45 || state.worldActions.lookedAtTree)
    ) {
      state.npcLocations.eve = "central_meadow";
      pushResolution({
        npcId: "eve",
        narration: "那个女人离开园中树林，走向园子中央。她没有看蛇，只是望着两棵树所在的方向。",
      });
    } else if (
      state.npcLocations.eve === "central_meadow" &&
      !state.worldActions.lookedAtTree &&
      state.eveMind.selfJudgement >= 25 &&
      state.eveMind.selfJudgement < 45
    ) {
      state.npcLocations.eve = "adam_garden_work";
      pushResolution({
        npcId: "eve",
        narration: "那个女人没有继续靠近树。她去了万物受名处，像是想向亚当问清那句禁令。",
      });
    } else if (
      state.npcLocations.eve === "adam_garden_work" &&
      (state.eveMind.selfJudgement >= 45 || state.worldActions.lookedAtTree)
    ) {
      state.npcLocations.eve = "central_meadow";
      pushResolution({
        npcId: "eve",
        narration: "从万物受名处回来后，那个女人又走向园子中央。她的问题没有被亚当完全安放。",
      });
    }
  }

  // 4. 亚当只有被本轮低语触动后，才可能离开万物受名处。
  //    他最多移动到园子中央，用来回应女人靠近树或对禁令产生疑问。
  if (spokenNpcIds.has("adam") && !state.isEnded) {
    if (
      state.npcLocations.adam === "adam_garden_work" &&
      (state.npcLocations.eve === "central_meadow" ||
        state.worldActions.lookedAtTree ||
        state.adamMind.attachmentToEve >= 80)
    ) {
      state.npcLocations.adam = "central_meadow";
      pushResolution({
        npcId: "adam",
        narration: "亚当放下手里的工，走向园子中央。他似乎在寻找那个女人，也在回想自己听见的命令。",
      });
    } else if (
      state.npcLocations.adam === "central_meadow" &&
      state.npcLocations.eve === "adam_garden_work"
    ) {
      state.npcLocations.adam = "adam_garden_work";
      pushResolution({
        npcId: "adam",
        narration: "亚当离开园子中央，回到万物受名处。那个女人在那里等着一个答案。",
      });
    }
  }

  state.npcActionPoints = remainingNpcActions;
  return resolutions;
}
