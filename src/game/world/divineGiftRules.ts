// ============================================================
// 第一章神明献礼规则层（T6：7 献礼三选一 + 累计注视驱动）
//
// 职责：
// - 神的注视等级显示（基于已选献礼数）
// - 累计注视阈值决定下一次三选一
// - 三选一候选抽取（rollGiftChoices）
// - 玩家选定献礼（claimDivineGift）
// - 集满 7 献礼的顶点演出（applyGiftCapstone）
// ============================================================

import type {
  DivineGiftId,
  EdenWorldState,
  EdenNpcId,
  TimeSlot,
} from "@/game/world/types";

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

// ---- 神的注视阶段显示（基于已选献礼数） ----
export function getDivineAttentionStage(ownedCount: number): DivineAttentionStage {
  if (ownedCount <= 0) return { title: "神的注视", tone: "dark_gold" };
  if (ownedCount <= 2) return { title: "神在垂听", tone: "amber_gold" };
  if (ownedCount <= 4) return { title: "神在鉴察", tone: "white_gold" };
  return { title: "神临不息", tone: "white_flame" };
}

// ---- 累计注视阈值（第 2~7 个三选一的触发点） ----
export const DIVINE_GIFT_THRESHOLDS = [2, 3, 4, 5, 6, 7];

// ---- 7 献礼池 ----
export const DIVINE_GIFT_POOL: DivineGiftId[] = [
  "gift_all_seduction_up",
  "gift_attention_accel",
  "gift_resonance_double",
  "gift_threshold_cut",
  "gift_free_move",
  "gift_whisper_anywhere",
  "gift_awaken_desire",
];

// ---- 献礼元数据（前端展示 + 回响被动接入） ----
export const DIVINE_GIFT_META: Record<
  DivineGiftId,
  { name: string; description: string; shortEffect: string; icon: string }
> = {
  gift_all_seduction_up: {
    name: "低语之诱",
    description: "神使你的话语更柔软动人，低语更易打动听者。",
    shortEffect: "低语效果系数 ×1.35",
    icon: "🗨️",
  },
  gift_attention_accel: {
    name: "注视加速",
    description: "神更留意园中的动静，你的每一次试探都更被看见。",
    shortEffect: "神的注视增量 ×1.5",
    icon: "👁️",
  },
  gift_resonance_double: {
    name: "回响倍涌",
    description: "你拾得的回响更浓，效果翻倍。",
    shortEffect: "回响效果 ×2",
    icon: "🌊",
  },
  gift_threshold_cut: {
    name: "界限松弛",
    description: "神在夏娃心中松动了一道界限，她更易走向自己的判断。",
    shortEffect: "夏娃提示词注入：更愿自我判断",
    icon: "✂️",
  },
  gift_free_move: {
    name: "无羁之步",
    description: "神准你自由穿行园中，移动不再消耗行动。",
    shortEffect: "移动不消耗行动点",
    icon: "👣",
  },
  gift_whisper_anywhere: {
    name: "随处低语",
    description: "你的声音能越过距离，同场景的校验被放宽。",
    shortEffect: "低语同场景校验放行",
    icon: "🌀",
  },
  gift_awaken_desire: {
    name: "渴望苏醒",
    description: "神在夏娃心里点起一丝对知识的渴望。",
    shortEffect: "夏娃提示词注入：更想了解善恶",
    icon: "🔥",
  },
};

export function getGiftMeta(giftId: DivineGiftId) {
  return DIVINE_GIFT_META[giftId];
}

// ---- 从未选过的献礼中随机抽 3 个供三选一（不足 3 个则全展示） ----
export function rollGiftChoices(owned: DivineGiftId[]): DivineGiftId[] {
  const remain = DIVINE_GIFT_POOL.filter((g) => !owned.includes(g));
  // Fisher–Yates 洗牌
  for (let i = remain.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [remain[i], remain[j]] = [remain[j], remain[i]];
  }
  return remain.slice(0, Math.min(3, remain.length));
}

// ---- 有效献礼门槛 = 当前阶段基础门槛 + 永久门槛修正（最低 1） ----
export function getEffectiveDivineThreshold(state: EdenWorldState): number | null {
  const owned = state.divineGiftsOwned.length;
  if (owned === 0 || owned >= 7) return null; // 开局 / 集满不显示
  const base = DIVINE_GIFT_THRESHOLDS[owned - 1];
  const modifier = state.divineThresholdModifier ?? 0;
  return Math.max(1, base + modifier);
}

// ---- 是否达到下一次三选一阈值（开局后第 N 个，N=owned.length） ----
export function shouldTriggerGiftChoice(state: EdenWorldState): boolean {
  const threshold = getEffectiveDivineThreshold(state);
  if (threshold === null) return false;
  return state.divineAttentionCumulative >= threshold;
}

// ---- 玩家三选一选定一个献礼 ----
export function claimDivineGift(
  state: EdenWorldState,
  giftId: DivineGiftId,
): DivineGiftResult {
  if (!state.divineGiftsOwned.includes(giftId)) {
    state.divineGiftsOwned.push(giftId);
  }
  state.divineVisitCount = state.divineGiftsOwned.length;
  state.divineGiftHistory.push({
    timeSlot: state.timeSlot,
    giftId,
    reason: "三选一",
  });
  // 作为被动回响发放（自动生效，无需主动使用）
  if (!state.inventory.includes(giftId)) {
    state.inventory.push(giftId);
  }
  state.itemCounts[giftId] = (state.itemCounts[giftId] ?? 0) + 1;

  // 集满顶点：全 NPC 对玩家好感 = 100
  if (state.divineGiftsOwned.length >= 7) {
    applyGiftCapstone(state);
  }

  // T2 Bug A：领取献礼后累计注视归零，不留溢出
  state.divineAttentionCumulative = 0;

  const meta = DIVINE_GIFT_META[giftId];
  return {
    giftId,
    giftName: meta.name,
    narration: meta.description,
  };
}

// ---- 集满 7：强制全 NPC 对玩家好感 = 100（obedience 不变） ----
export function applyGiftCapstone(state: EdenWorldState): void {
  state.eveMind.serpentTrust = 100;
  state.adamMind.suspicionTowardSerpent = 0; // =>100 好感
  for (const npc of ["gabriel", "michael", "lucifer", "hedgehog"] as EdenNpcId[]) {
    const r =
      state.npcRelations[npc] ??
      (state.npcRelations[npc] = {
        affinity: 0,
        obedience: 50,
        rewardEligible: false,
        rewardClaimed: false,
        lastAffinitySignature: null,
      });
    r.affinity = 100;
    r.rewardEligible = true;
  }
}
