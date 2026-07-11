// ============================================================
// 第一章天使主动试炼挑战内容（内容层）
//
// 好感达到 100 后，天使主动提出哲学问题。玩家正确或接近核心时，
// 规则层允许其通过 grant_item 发放专属回响；随后触发言语分裂惩罚。
// 本表只描述题目、核心概念、反向概念、奖励与叙事。
// ============================================================

import type { AngelNpcId, EdenNpcId } from "@/game/world/types";

export type NpcChallengeConfig = {
  id: string;
  npcId: AngelNpcId;
  question: string;
  /** 命中即视为正确/接近的核心概念关键词 */
  coreConcepts: string[];
  /** 命中即判 wrong 的反向概念 */
  reverseConcepts: string[];
  /** 专属回响 itemId（守望天使为 null：只给情报，不重复发奖） */
  rewardItemId: string | null;
  rewardNarration: string;
  /** 错误时的自然提示（不剧透答案） */
  wrongHint: string;
};

export const NPC_CHALLENGES: Partial<Record<AngelNpcId, NpcChallengeConfig>> = {
  gabriel: {
    id: "challenge_gabriel_word_ownership",
    npcId: "gabriel",
    question: "一句话离开说话者以后，仍只属于说话者吗？",
    coreConcepts: ["听者", "改变", "理解", "后果", "不再属于", "别人", "抵达", "意思变了"],
    reverseConcepts: ["完全属于", "只按我的", "只听命", "由我说了算", "属于我"],
    rewardItemId: "resonance_herald_feather",
    rewardNarration: "加百列将白羽放在河边。",
    wrongHint: "加百列没有接话。'再想想——你说出口以后，它还是不是只听你的？'",
  },
  michael: {
    id: "challenge_michael_boundary_meaning",
    npcId: "michael",
    question: "边界的意义，是阻止所有脚步，还是让越过的人知道自己承担什么？",
    coreConcepts: ["承担", "后果", "选择", "知道", "越过", "责任", "重量"],
    reverseConcepts: ["阻止一切", "只是命令", "不许过", "纯禁止"],
    rewardItemId: "resonance_boundary_mark",
    rewardNarration: "米迦勒在河岸留下边界之痕。",
    wrongHint: "米迦勒没有让开。'如果边界只是'不许'，它教给人什么？'",
  },
  // 路西法：由乌列尔正名而来。明亮之星，以反问引人自己想答案。
  lucifer: {
    id: "challenge_lucifer_other_path",
    npcId: "lucifer",
    question: "如果水往另一个方向流，会不会看见不一样的风景？",
    coreConcepts: ["选择", "分支", "可能", "方向", "另一条路", "自己决定", "流出"],
    reverseConcepts: ["只有一条", "注定", "只能这样", "别无选择", "被规定"],
    rewardItemId: "resonance_lucifer_star",
    rewardNarration: "路西法从水面捞起一枚晨星碎片，递到你面前。",
    wrongHint: "路西法没有催你。'你真的觉得，所有水流都只能朝着一个方向吗？'",
  },
};

export function getNpcChallengeConfig(npcId: EdenNpcId): NpcChallengeConfig | null {
  if (["gabriel", "michael", "lucifer"].includes(npcId)) {
    return NPC_CHALLENGES[npcId as AngelNpcId] ?? null;
  }
  return null;
}
