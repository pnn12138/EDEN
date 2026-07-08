// ============================================================
// 第一章神明献礼规则层
//
// 职责：
// - 管理神的注视阶段显示
// - 决定神明献礼类型
// - 发放神明献礼
// - 触发条件：神的注视满 4 时触发献礼并归零，不触发失败
// ============================================================

import type { DivineGiftId, EdenWorldState, TimeSlot } from "@/game/world/types";

// ---- 神的注视阶段 ----
export type DivineAttentionStage = {
  title: string;
  tone: "dark_gold" | "amber_gold" | "white_gold" | "white_flame";
};

// ---- 神明献礼结果 ----
export type DivineGiftResult = {
  giftId: DivineGiftId;
  giftName: string;
  narration: string;
  hint?: string;
};

// ---- 神的注视阶段显示 ----
export function getDivineAttentionStage(divineVisitCount: number): DivineAttentionStage {
  if (divineVisitCount <= 0) return { title: "神的注视", tone: "dark_gold" };
  if (divineVisitCount <= 2) return { title: "神在垂听", tone: "amber_gold" };
  if (divineVisitCount <= 4) return { title: "神在鉴察", tone: "white_gold" };
  return { title: "神临不息", tone: "white_flame" };
}

// ---- 决定神明献礼类型 ----
export function resolveDivineGift(state: EdenWorldState): DivineGiftId {
  // 优先：行动点 ≤ 1 时给予息日露滴
  if (state.actionPoints <= 1) return "gift_sabbath_dew";
  // 其次：有可获得的回响提示时给予照见之光
  if (getNearMissResonanceHint(state)) return "gift_revealing_light";
  // 默认：给予宽行之印
  return "gift_wide_path_seal";
}

// ---- 获取回响提示（P0 简化版） ----
export function getNearMissResonanceHint(state: EdenWorldState): string | null {
  // 根据已有线索/地点/未拥有回响返回明确提示
  // 不随机，不剧透全部条件

  // 传令白羽：位于伊甸之河时与加百列谈论传话/声音
  if (
    !state.inventory.includes("resonance_herald_feather") &&
    state.locationId === "four_river_source" &&
    state.timeOfDay === "day"
  ) {
    return "加百列在河源守望。与他谈论传话与声音，或许能获得一片白羽。";
  }

  // 晨焰碎片：需要 clue_two_trees 且未拥有 resonance_morning_flame
  if (
    !state.inventory.includes("resonance_morning_flame") &&
    state.discoveredClues.includes("clue_two_trees")
  ) {
    return "乌列尔在幽径守望夜晚。与他谈论分辨与善恶，光会分出一束火焰。";
  }

  // 边界之痕：神已注视或曾临在，位于四河分流
  if (
    !state.inventory.includes("resonance_boundary_mark") &&
    (state.divineAttention > 0 || state.divineVisitCount > 0) &&
    state.locationId === "naming_stone_bank"
  ) {
    return "米迦勒在分流处守望。对他谈论边界与选择，他会留下一道震颤的痕迹。";
  }

  // 东门辉光：位于东园幽径，尚未对女人低语，与基路伯谈论路/门
  if (
    !state.inventory.includes("resonance_east_gate_glow") &&
    state.locationId === "east_garden_path" &&
    !state.actionsThisSlot.whisperedNpcIds.includes("eve")
  ) {
    return "基路伯守望着东门。在靠近女人之前，与他谈论道路与方向，辉光会为你让路。";
  }

  // 借来的名字：需要 clue_naming_stones 且未拥有 resonance_borrowed_name
  if (
    !state.inventory.includes("resonance_borrowed_name") &&
    state.discoveredClues.includes("clue_naming_stones")
  ) {
    return "名字的痕迹尚未完全沉默。查看刻名石后，一段借来的名字会留在你的回响中。";
  }

  // 信任之露：中央草地，未拥有
  if (
    !state.inventory.includes("consumable_trust_dew") &&
    state.locationId === "central_meadow"
  ) {
    return "园子中央的草地被两棵树守护。停在这里感受它的静，或许能拾起一滴信任的露水。";
  }

  return null;
}

// ---- 发放神明献礼 ----
export function grantDivineGift(
  state: EdenWorldState,
  giftId: DivineGiftId
): DivineGiftResult {
  // 增加道具次数
  state.itemCounts[giftId] = (state.itemCounts[giftId] ?? 0) + 1;

  // 如果首次获得，加入 inventory
  if (!state.inventory.includes(giftId)) {
    state.inventory.push(giftId);
  }

  // 记录神临次数
  state.divineVisitCount += 1;

  // 记录献礼历史
  state.divineGiftHistory.push({
    timeSlot: state.timeSlot,
    giftId,
    reason: "神的注视满盈后留下献礼",
  });

  // 根据 giftId 返回结果
  if (giftId === "gift_sabbath_dew") {
    return {
      giftId,
      giftName: "息日露滴",
      narration: "光落在草尖，留下一滴安静的露。它留在你的回响中，可在行动紧张时恢复一点余地。",
    };
  }

  if (giftId === "gift_revealing_light") {
    // 照见之光：提供回响提示
    const hint =
      getNearMissResonanceHint(state) ??
      "园中有一段回响将要成形，只差一次合适的对话或行动。";
    state.lastDivineGiftHint = hint;
    return {
      giftId,
      giftName: "照见之光",
      narration: "一束光照过叶影，使一条尚未走完的路短暂显明。",
      hint,
    };
  }

  // 宽行之印：无额外效果，只是标记
  return {
    giftId,
    giftName: "宽行之印",
    narration: "草叶向两侧伏下，像有一条路暂时被宽恕。",
  };
}

// ---- 触发神明献礼（如果神的注视满 4） ----
export function triggerDivineGiftIfFull(state: EdenWorldState): DivineGiftResult | null {
  // 条件：神的注视 < 4 或已结束，不触发
  if (state.divineAttention < 4 || state.isEnded) return null;

  // 决定献礼类型
  const giftId = resolveDivineGift(state);

  // 归零神的注视
  state.divineAttention = 0;

  // 发放献礼
  return grantDivineGift(state, giftId);
}
