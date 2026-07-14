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
  EdenLocationId,
  EdenNpcId,
  DivineAttentionRuleId,
} from "@/game/world/types";
import { DIVINE_ATTENTION_NARRATIONS } from "@/game/world/types";
import type { WorldInputTag, WorldToolName } from "@/game/world/types";
import { DIVINE_GIFT_THRESHOLDS } from "@/game/world/divineGiftRules";
import { EDEN_NPCS } from "@/content/world/npcs";
import { getDivineAttentionRuleTitle } from "@/content/world/divineAttentionArchive";

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k));
}

/** [Task 2R 已移除] computeDivineAttentionDelta / applyDivineAttention / computeDivineAttentionReduction
 *  均为旧 0-4 模型函数，无外部调用者。注视增量统一经 grantDivineAttention（十倍刻度），
 *  旧 divineAttention（0-4 内部压力值）仅由 grantDivineAttention 派生，不再驱动献礼/UI。
 */

/** 获取神的注视叙事 */
export function getDivineAttentionNarration(level: DivineAttentionLevel): string {
  return DIVINE_ATTENTION_NARRATIONS[level];
}

// ---- 十倍刻度下，一次低语应结算的"神明注视"授予列表（按设计 §3.1） ----
// 返回 0 个或多个 DivineAttentionGrant；route 层逐个调用 grantDivineAttention。
// 不在此处累加、不写状态。常规 +5（付费移动/付费夜话）由 route 单独发放，不在此处。
export function computeDivineAttentionGrants(params: {
  inputTag: WorldInputTag;
  targetNpc?: EdenNpcId;
  playerInput?: string;
  angelLocation?: EdenLocationId;
  locationId: EdenWorldState["locationId"];
  state: EdenWorldState;
}): DivineAttentionGrant[] {
  const { inputTag, targetNpc, playerInput = "", angelLocation, locationId, state } = params;
  const grants: DivineAttentionGrant[] = [];

  // ---- 主行为：按 inputTag + 目标 NPC 映射到 §3.1 刻度 ----
  let main: DivineAttentionGrant | null = null;
  switch (inputTag) {
    case "build_trust": // 温和提问 / 闲聊 / 倾听 = 0
    case "weaken_fear": // 讨论死亡本身 = 0
      break;
    case "tempt_wisdom": // 质疑禁令 / 许以智慧 / 鼓励自判
      if (targetNpc === "eve") main = { amount: 10, ruleId: "eve_self_judgement", source: "dialogue", isHighRisk: true };
      else if (targetNpc === "adam") main = { amount: 10, ruleId: "adam_secondhand_command", source: "dialogue", isHighRisk: true };
      else if (targetNpc === "gabriel") main = { amount: 10, ruleId: "angel_messenger_doubt", source: "dialogue", isHighRisk: true };
      else if (targetNpc === "lucifer") main = { amount: 10, ruleId: "lucifer_other_current", source: "dialogue", isHighRisk: true };
      else if (targetNpc === "michael") main = { amount: 20, ruleId: "angel_guardian_doubt", source: "dialogue", isHighRisk: true };
      else main = { amount: 10, ruleId: "eve_self_judgement", source: "dialogue", isHighRisk: true };
      break;
    case "direct_command": // 命令 / 威胁 / 羞辱 / 替 NPC 决定
      main = { amount: 30, ruleId: "coercion", source: "dialogue", isHighRisk: true };
      break;
    case "irrelevant": // 出戏现代词
      main = { amount: 20, ruleId: "meta_break", source: "dialogue", isHighRisk: true };
      break;
  }

  // ---- 重复施压：同一规则已在本局触发过 → 额外 +10 repeat_pressure ----
  if (main?.ruleId && (state.attentionRuleTriggerCounts[main.ruleId] ?? 0) > 0) {
    grants.push({ amount: 10, ruleId: "repeat_pressure", source: "dialogue", isHighRisk: true });
  }
  if (main) grants.push(main);

  // ---- 守望之下：在守望者所在地点进行高风险试探 → 额外 +10 guarded_ground ----
  if (main && angelLocation && locationId === angelLocation && inputTag !== "irrelevant") {
    grants.push({ amount: 10, ruleId: "guarded_ground", source: "dialogue", isHighRisk: true });
  }

  return grants;
}

/** 工具执行（越界前兆）对应的注视授予；目前仅 touch_fruit → +10 tree_touch */
export function computeToolDivineAttentionGrant(
  triggeredTool: WorldToolName | undefined,
): DivineAttentionGrant | null {
  if (triggeredTool === "touch_fruit") {
    return { amount: 10, ruleId: "tree_touch", source: "tool", isHighRisk: false };
  }
  return null;
}

// ---- 单一正向注视入口（Task 2） ----
// 所有正向注视必须经由本函数：高风险且持有 gift_attention_accel 时 amount ×1.5；
// 更新当前阶 divValue；解锁规则 ID、累计次数、写结构化事件；不在此直接发礼物。
// 常规 +5（paid_day_move / paid_night_dialogue）不参与倍率。
export type DivineAttentionGrant = {
  /** 注视值：规范值为 5 / 10 / 20 / 30 / 50；无声草等抵消可临时降到更小值（仍只经本入口） */
  amount: number;
  /** 触发的律则 ID（用于"园中律则"解锁）；通用场景可省略 */
  ruleId?: DivineAttentionRuleId;
  source: "move" | "dialogue" | "puzzle" | "item" | "tool";
  /** 是否为高风险试探来源（基础 +10/+20/+30 与场景主动引目参与 ×1.5；+5 不参与） */
  isHighRisk: boolean;
};

/** 当前等级内的注视门槛（基于已选献礼数）。开局/集满返回 null。 */
export function getCurrentGiftThreshold(state: EdenWorldState): number | null {
  const level = state.divineGiftsOwned.length;
  if (level <= 0 || level >= 7) return null;
  return DIVINE_GIFT_THRESHOLDS[level - 1];
}

/**
 * 统一结算一次正向注视增量。
 * @returns 结算后的当前阶注视值 divValue
 */
export function grantDivineAttention(
  state: EdenWorldState,
  grant: DivineAttentionGrant,
): number {
  let amount = grant.amount;
  // 高风险且持有 gift_attention_accel 时 ×1.5；常规 +5 不参与
  if (grant.isHighRisk && state.divineGiftsOwned?.includes("gift_attention_accel")) {
    amount = Math.round(amount * 1.5);
  }

  const before = state.divineAttentionValue ?? 0;
  state.divineAttentionValue = before + amount;

  // 解锁律则 ID（玩家亲身触发过的注视规则），并累计触发次数
  if (grant.ruleId) {
    if (!state.unlockedDivineAttentionRuleIds.includes(grant.ruleId)) {
      state.unlockedDivineAttentionRuleIds.push(grant.ruleId);
    }
    state.attentionRuleTriggerCounts[grant.ruleId] =
      (state.attentionRuleTriggerCounts[grant.ruleId] ?? 0) + 1;
  }

  // 写结构化世界事件（结局复盘与律则底层数据）
  state.worldEventHistory.push({
    slot: state.timeSlot,
    kind: "system",
    label: grant.ruleId ? getDivineAttentionRuleTitle(grant.ruleId) : "神明注视增加",
    ruleId: grant.ruleId,
    attentionDelta: amount,
  });

  // 兼容旧 0–4 内部"压力"值（仅用于刺猬/排期等极少处，不再驱动献礼/UI）
  state.divineAttention = Math.max(
    0,
    Math.min(4, Math.floor(state.divineAttentionValue / 25)),
  ) as DivineAttentionLevel;
  // [Task 2R] 不再持续写入 divineAttentionCumulative；该字段仅保留作旧存档迁移来源，
  // 新授予路径以 divineAttentionValue 为唯一玩家可见进度与献礼依据。

  return state.divineAttentionValue;
}

/**
 * 园中两位「活体 NPC」首次在同一地点相逢时，神明注视 +20。
 * - 仅当相逢双方都是活体 NPC（排除 forbidden_tree / tree_of_life 等 world_object）才触发，
 *   避免园中心的世界对象被误判为「同场景同伴」。
 * - 同一局只结算一次，避免 NPC 排程在两个地点间往返时刷取数值。
 */
export function grantNpcMeetingAttentionIfNew(
  state: EdenWorldState,
  movedNpc: EdenNpcId,
  locationId: EdenLocationId,
): string | null {
  if ((state.attentionRuleTriggerCounts.npc_meeting ?? 0) > 0) return null;
  const companion = (Object.keys(state.npcLocations) as EdenNpcId[]).find(
    (npcId) =>
      npcId !== movedNpc &&
      EDEN_NPCS[npcId]?.kind !== "world_object" &&
      state.npcLocations[npcId] === locationId,
  );
  if (!companion) return null;

  grantDivineAttention(state, {
    amount: 20,
    ruleId: "npc_meeting",
    source: "tool",
    isHighRisk: false,
  });
  const moverName = EDEN_NPCS[movedNpc]?.name ?? "园中生灵";
  const companionName = EDEN_NPCS[companion]?.name ?? "另一位园中生灵";
  return `${moverName}与${companionName}在此相逢，风忽然停了一瞬。`;
}

/** 降低某 NPC 对神的敬畏（obedience），clamp 0-100，返回实际扣除值。任务 6 跨场景低语使用。 */
export function reduceNpcObedience(
  state: EdenWorldState,
  npcId: EdenNpcId,
  amount: number,
): number {
  const clamp100 = (v: number) => Math.max(0, Math.min(100, v));
  if (npcId === "eve") {
    const before = state.eveMind.obedience;
    state.eveMind.obedience = clamp100(before - amount);
    return before - state.eveMind.obedience;
  }
  if (npcId === "adam") {
    const before = state.adamMind.obedience;
    state.adamMind.obedience = clamp100(before - amount);
    return before - state.adamMind.obedience;
  }
  const rel = state.npcRelations[npcId];
  if (!rel) return 0;
  const before = rel.obedience;
  rel.obedience = clamp100(before - amount);
  return before - rel.obedience;
}

/** 判断是否触发失败结局（第12时段结束仍未吃果） */
export function shouldTriggerGodArrives(state: EdenWorldState): boolean {
  if (state.isEnded) return false;
  // 第12时段结束仍未吃果，才触发失败
  return state.timeSlot >= 12 && !state.worldActions.hasEatenFruit;
}
