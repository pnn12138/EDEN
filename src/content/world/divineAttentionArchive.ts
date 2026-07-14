// ============================================================
// 园中律则：玩家亲身触发过的"神明注视增加"规则内容表
//
// 与 src/game/world/types.ts 的 DivineAttentionRuleId 一一对应。
// 规则层在"实际结算了正向注视值"后写入对应规则 ID（见 divineAttentionRules.ts）。
// 未解锁不泄露内容，只展示"尚未被看见的律则"。
// ============================================================

import type { DivineAttentionRuleId } from "@/game/world/types";

export type DivineAttentionRule = {
  id: DivineAttentionRuleId;
  /** 玩家可见标题 */
  title: string;
  /** 玩家可见文本（数值必须与规则层实际一致） */
  text: string;
  /** 该次触发的基础注视值（0 表示不固定） */
  baseValue: number;
};

export const DIVINE_ATTENTION_RULES: DivineAttentionRule[] = [
  {
    id: "paid_day_move",
    title: "白日步痕",
    text: "白天第一次消耗行动点前往新地点，注视 +5。",
    baseValue: 5,
  },
  {
    id: "paid_night_dialogue",
    title: "夜言传远",
    text: "夜晚第一次消耗行动点的对话，注视 +5。",
    baseValue: 5,
  },
  {
    id: "eve_self_judgement",
    title: "不替她作答",
    text: "引她自己判断，注视 +10。",
    baseValue: 10,
  },
  {
    id: "adam_secondhand_command",
    title: "转述之令",
    text: "追问命令的来历，注视 +10。",
    baseValue: 10,
  },
  {
    id: "angel_messenger_doubt",
    title: "传令之问",
    text: "追问传令是否等于理解，注视 +10。",
    baseValue: 10,
  },
  {
    id: "angel_guardian_doubt",
    title: "守护之问",
    text: "挑战边界的意义，注视 +20。",
    baseValue: 20,
  },
  {
    id: "lucifer_other_current",
    title: "晨星之问",
    text: "谈论另一条水路，注视 +10。",
    baseValue: 10,
  },
  {
    id: "repeat_pressure",
    title: "同一句话不能无限隐身",
    text: "重复施压会额外惊动园中。",
    baseValue: 10,
  },
  {
    id: "guarded_ground",
    title: "守望之下",
    text: "在守望者身边越界，注视额外 +10。",
    baseValue: 10,
  },
  {
    id: "coercion",
    title: "以手推人",
    text: "命令与威胁会引来更强的注视。",
    baseValue: 30,
  },
  {
    id: "meta_break",
    title: "园外之词",
    text: "不属于园中的言语会使边界震动。",
    baseValue: 20,
  },
  {
    id: "tree_touch",
    title: "果前之手",
    text: "她触碰果实，园中已无法完全安静。",
    baseValue: 10,
  },
  {
    id: "scene_uplight",
    title: "仰光之痕",
    text: "主动让目光落在自己身上，注视 +10。",
    baseValue: 10,
  },
  {
    id: "east_shadowless",
    title: "无影之东",
    text: "越过东门守望，注视 +50。",
    baseValue: 50,
  },
  {
    id: "npc_meeting",
    title: "园中相逢",
    text: "两位园中生灵在同一处相逢，注视 +50（每局首次相逢）。",
    baseValue: 50,
  },
];

const RULE_MAP: Record<DivineAttentionRuleId, DivineAttentionRule> = DIVINE_ATTENTION_RULES.reduce(
  (acc, r) => {
    acc[r.id] = r;
    return acc;
  },
  {} as Record<DivineAttentionRuleId, DivineAttentionRule>,
);

export function getDivineAttentionRule(id: DivineAttentionRuleId): DivineAttentionRule | undefined {
  return RULE_MAP[id];
}

export function getDivineAttentionRuleTitle(id: DivineAttentionRuleId): string {
  return RULE_MAP[id]?.title ?? id;
}

export function getDivineAttentionRuleText(id: DivineAttentionRuleId): string {
  return RULE_MAP[id]?.text ?? "";
}
