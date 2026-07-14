// ============================================================
// 第一章轻量 NPC 时段行动结算
//
// 不做完整 NPC 自主规划器。每次时段推进时做规则化结算：
// - 神的注视升高时，刺猬警觉或躲藏
// - 夜晚伊甸之河出现天使边界提示
//
// 女人与亚当的「移动」不再在此处硬编码：他们各自通过 move_to_location 工具自行决定去哪里，
// 在对话回合内经邻接校验后真正生效。本文件只做叙事与轻量心智/情绪状态影响，不抢玩家控制权。
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

  // 3. 女人与亚当的移动都不再由时段结算硬编码：是否离开当前所在、往哪里去，
  //    现由各自信的 Agent 通过 move_to_location 工具自行决定（在对话回合结束后才真正生效，
  //    见 world/route.ts 的延迟生效逻辑与邻接校验）。此处不再自动搬运任何人的位置，
  //    以免「亚当被强制送到园子中央」这类脚本化行为覆盖他自己的意愿（他应自己选择去哪里）。
  //    万物受名处（adam_garden_work）本就与园子中央相邻，亚当只需发出
  //    move_to_location（args: { locationId: "central_meadow" }）即可合法前往。

  state.npcActionPoints = remainingNpcActions;
  return resolutions;
}
