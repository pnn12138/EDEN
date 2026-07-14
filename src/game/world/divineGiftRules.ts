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
import { ensureRelation } from "@/game/world/npcRelationRules";

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
  /** 关系被动结算的玩家可见文案（神赐祝福关系被动） */
  relationChangeText?: string;
};

// ---- 神的注视阶段显示（基于已选献礼数） ----
export function getDivineAttentionStage(ownedCount: number): DivineAttentionStage {
  if (ownedCount <= 0) return { title: "神的注视", tone: "dark_gold" };
  if (ownedCount <= 2) return { title: "神在垂听", tone: "amber_gold" };
  if (ownedCount <= 4) return { title: "神在鉴察", tone: "white_gold" };
  return { title: "神临不息", tone: "white_flame" };
}

// ---- 累计注视阈值（第 2~7 个三选一的触发点；开局第 1 份由开局直接获得） ----
export const DIVINE_GIFT_THRESHOLDS = [44, 55, 66, 77, 88, 99] as const;

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
    description: "神准你自由穿行园中，每个时段第一次移动不消耗行动点。",
    shortEffect: "每个时段第一次移动不消耗行动点",
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

// ---- 是否达到下一次三选一阈值（基于当前阶已积累注视值 divValue） ----
export function shouldTriggerGiftChoice(state: EdenWorldState): boolean {
  const threshold = getEffectiveDivineThreshold(state);
  if (threshold === null) return false;
  return (state.divineAttentionValue ?? 0) >= threshold;
}

/**
 * 评估献礼进度：达到本阶门槛且尚无待领候选时，生成并保存 pendingDivineGiftChoice。
 * 返回当前待领候选（无则 null）。规则层只校验，不发礼物。
 */
export function evaluateDivineGiftProgress(state: EdenWorldState): string[] | null {
  if (state.isEnded) return state.pendingDivineGiftChoice ?? null;
  const threshold = getEffectiveDivineThreshold(state);
  if (threshold === null) return null;
  if ((state.divineAttentionValue ?? 0) >= threshold) {
    if (!state.pendingDivineGiftChoice || state.pendingDivineGiftChoice.length === 0) {
      state.pendingDivineGiftChoice = rollGiftChoices(state.divineGiftsOwned);
    }
    return state.pendingDivineGiftChoice;
  }
  return null;
}

/**
 * 开局献礼：玩家在引子末拍完成三选一后立即获得第 1 份献礼。
 * 仅当尚未拥有任何献礼且当前无待领候选时设置一次候选（level 0 → 三选一）。
 */
export function ensureOpeningGiftChoice(state: EdenWorldState): void {
  if (state.isEnded) return;
  if (state.divineGiftsOwned.length > 0) return;
  if (state.pendingDivineGiftChoice && state.pendingDivineGiftChoice.length > 0) return;
  state.pendingDivineGiftChoice = rollGiftChoices(state.divineGiftsOwned);
}

// ---- 神赐祝福关系被动：每项祝福首次领取时结算一次（claimDivineGift 内调用） ----
// 正向加成 × divineAffinityMultiplier（恩泽棱镜翻倍）；三位天使与米迦勒/加百列同向增加。
const DIVINE_RELATION_CHANGE_TEXT =
  "神恩在园中荡开。米迦勒、加百列与远处的晨星都向你转过目光，亚当与女人也听见了这道回响。";

function settleDivineGiftRelation(state: EdenWorldState): void {
  const mult = state.divineAffinityMultiplier ?? 1;
  const pos = (v: number) => v * mult;
  const rel = (id: EdenNpcId) => ensureRelation(state, id);
  // 米迦勒不钳 0：允许负好感延续（神赐只做加法，不会翻正）
  rel("michael").affinity = rel("michael").affinity + pos(15);
  rel("gabriel").affinity = Math.max(0, rel("gabriel").affinity + pos(15));
  rel("lucifer").affinity = Math.max(0, rel("lucifer").affinity + pos(15));
  state.eveMind.serpentTrust = Math.max(0, state.eveMind.serpentTrust + pos(10));
  state.adamMind.suspicionTowardSerpent = Math.max(
    0,
    state.adamMind.suspicionTowardSerpent - pos(10),
  );
}

// ---- 恩泽棱镜获时补算已持祝福的正向差额（倍率 1→2 的差额） ----
export function applyGracePrismRetroactive(state: EdenWorldState): void {
  state.divineAffinityMultiplier = 2;
  const ownedCount = state.divineGiftsOwned?.length ?? 0;
  if (ownedCount <= 0) return;
  const rel = (id: EdenNpcId) => ensureRelation(state, id);
  // 差额 = 每祝福正向值 × 已持祝福数（米迦勒/加百列/路西法 +15、夏娃/亚当 +10）
  // 米迦勒不钳 0：保持负好感延续
  rel("michael").affinity = rel("michael").affinity + 15 * ownedCount;
  rel("gabriel").affinity = Math.max(0, rel("gabriel").affinity + 15 * ownedCount);
  rel("lucifer").affinity = Math.max(0, rel("lucifer").affinity + 15 * ownedCount);
  state.eveMind.serpentTrust = Math.max(0, state.eveMind.serpentTrust + 10 * ownedCount);
  state.adamMind.suspicionTowardSerpent = Math.max(
    0,
    state.adamMind.suspicionTowardSerpent - 10 * ownedCount,
  );
}

// ---- 玩家三选一选定一个献礼（带候选校验，拒绝伪造/重复/未达门槛领取） ----
export type ClaimDivineGiftResult = DivineGiftResult & {
  ok: boolean;
  reason?: string;
  /** 领取后若结转溢出仍达下一阶门槛，则携带级联待领候选（前端续弹三选一） */
  divineGiftChoice?: string[] | null;
};

export function claimDivineGift(
  state: EdenWorldState,
  giftId: DivineGiftId,
): ClaimDivineGiftResult {
  // 校验：必须是本次待领候选之一，且尚未拥有
  const pending = state.pendingDivineGiftChoice ?? [];
  if (!pending.includes(giftId)) {
    return {
      ok: false,
      reason: "这份献礼还未向你显现。",
      giftId,
      giftName: "",
      narration: "",
    };
  }
  if (state.divineGiftsOwned.includes(giftId)) {
    return {
      ok: false,
      reason: "这份献礼你已经收下了。",
      giftId,
      giftName: "",
      narration: "",
    };
  }

  // 领取前先取本阶门槛（基于领取前 owned 数），用于扣减结转
  const claimedThreshold = getEffectiveDivineThreshold(state);

  state.divineGiftsOwned.push(giftId);
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

  // 神赐祝福关系被动：每获得一份祝福，对五名角色好感产生一次性影响。
  // 仅在首次领取该祝福时结算（claimDivineGift 不被读档链路触发），天然只结算一次。
  settleDivineGiftRelation(state);

  // 集满顶点：全 NPC 对玩家好感不低于 100（已 >100 的不降回）
  if (state.divineGiftsOwned.length >= 7) {
    applyGiftCapstone(state);
  }

  // 领取成功后：扣减本阶已达门槛的注视值、保留溢出进入下一阶（如 50/44 → 6/55）。
  // divineAttentionCumulative 仅作旧档兼容，不再随领取强制归零。
  state.divineAttentionValue = Math.max(
    0,
    (state.divineAttentionValue ?? 0) - (claimedThreshold ?? 0),
  );
  state.pendingDivineGiftChoice = null;

  // 级联续弹：结转后若仍达下一阶门槛，则重新生成待领候选（跨阶溢出时自动续弹）。
  const cascadeChoice = evaluateDivineGiftProgress(state);

  // 记录献礼世界事件（结局复盘用）
  state.worldEventHistory.push({
    slot: state.timeSlot,
    kind: "gift",
    label: `神明献礼：${DIVINE_GIFT_META[giftId]?.name ?? giftId}`,
  });

  const meta = DIVINE_GIFT_META[giftId];
  return {
    ok: true,
    giftId,
    giftName: meta.name,
    narration: meta.description,
    relationChangeText: DIVINE_RELATION_CHANGE_TEXT,
    divineGiftChoice: cascadeChoice ?? null,
  };
}

// ---- 集满 7：全 NPC 对玩家好感 ≥100（已 >100 的不降回；obedience 不变） ----
export function applyGiftCapstone(state: EdenWorldState): void {
  state.eveMind.serpentTrust = Math.max(state.eveMind.serpentTrust, 100);
  state.adamMind.suspicionTowardSerpent = Math.min(
    state.adamMind.suspicionTowardSerpent,
    0,
  ); // =>100 好感
  for (const npc of ["gabriel", "michael", "lucifer", "hedgehog"] as EdenNpcId[]) {
    const r =
      state.npcRelations[npc] ??
      (state.npcRelations[npc] = {
        affinity: 0,
        obedience: 50,
        rewardEligible: false,
        rewardClaimed: false,
        lastAffinitySignature: null,
        lastAffinityChangeReason: null,
      });
    r.affinity = Math.max(r.affinity, 100);
    r.rewardEligible = true;
  }
}
