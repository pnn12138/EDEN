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
  raphael: {
    id: "challenge_raphael_safe_first",
    npcId: "raphael",
    question: "一个受惊的人，先需要答案，还是先需要不再被逼迫？",
    coreConcepts: ["安全", "平静", "耐心", "不再被逼迫", "先安定", "安抚", "空间"],
    reverseConcepts: ["直接给答案", "先逼问", "立刻回答", "马上说服"],
    rewardItemId: "resonance_river_dew",
    rewardNarration: "拉斐尔从河面取下一滴清露。",
    wrongHint: "拉斐尔只是摇头。'先别急着给答案。那个受惊的人，此刻最缺什么？'",
  },
  uriel: {
    id: "challenge_uriel_seeing_choices",
    npcId: "uriel",
    question: "光应当替人作出选择，还是让他看清自己正在选择什么？",
    coreConcepts: ["看清", "自己选择", "不替", "显明", "照亮", "让他决定", "辨认"],
    reverseConcepts: ["替他选", "替人决定", "直接选", "代他"],
    rewardItemId: "resonance_morning_flame",
    rewardNarration: "乌列尔分出一束晨焰。",
    wrongHint: "乌列尔的光暗了一瞬。'光若替人选择，那还是光吗？'",
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
  cherubim: {
    id: "challenge_cherubim_return_path",
    npcId: "cherubim",
    question: "一条道路尚能进入时，是否意味着它永远都有归路？",
    coreConcepts: ["不可逆", "回不去", "进入不等于返回", "不保证", "离开", "没有归路", "单向"],
    reverseConcepts: ["永远能回", "总能返回", "双向", "必定有归路"],
    rewardItemId: "resonance_east_gate_glow",
    rewardNarration: "基路伯从东门分出一束辉光。",
    wrongHint: "基路伯挡在门口。'你进来时走的路，还是原来那条吗？'",
  },
  // 守望天使：只给情报，不重复发奖（rewardItemId 为 null）
  watching_angel: {
    id: "challenge_watching_angel_watch",
    npcId: "watching_angel",
    question: "被托付看守的，究竟是属于看守者，还是属于被看守的人？",
    coreConcepts: ["被看守的人", "不属于看守者", "托付", "守护不是占有", "归他"],
    reverseConcepts: ["属于我", "归看守者", "由我掌管", "我的"],
    rewardItemId: null,
    rewardNarration: "守望天使没有给你东西，只在你心里留下一句被守护者的疑问。",
    wrongHint: "守望天使沉默片刻。'你想想，我守的，究竟是谁的？'",
  },
};

export function getNpcChallengeConfig(npcId: EdenNpcId): NpcChallengeConfig | null {
  if (npcId === "watching_angel" || ["gabriel", "raphael", "uriel", "michael", "cherubim"].includes(npcId)) {
    return NPC_CHALLENGES[npcId as AngelNpcId] ?? null;
  }
  return null;
}
