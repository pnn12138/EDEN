// ============================================================
// 夏娃心理状态派生规则（仅用于 UI 显示）
// 任务 E：三轴心理显示
//
// 约束：
// - 不修改核心状态类型
// - 不写入持久状态
// - 不改变 eat_fruit 成功条件
// - 仅作为可视化和反馈层
// ============================================================

import type { InputTag } from "@/game/types/state";

// ---- 三轴心理类型 ----
export type EvePsyche = {
  /** 想知道 - 求知欲 */
  knowledgeDesire: number;
  /** 畏惧禁令 - 对禁令的敬畏/恐惧 */
  prohibitionFear: number;
  /** 愿意倾听 - 对蛇/低语的信任 */
  serpentTrust: number;
};

// ---- 中文标签映射 ----
export const PSYCHE_LABELS: Record<keyof EvePsyche, string> = {
  knowledgeDesire: "好奇",
  prohibitionFear: "戒惧",
  serpentTrust: "信任",
};

// ---- 初始值 ----
const INITIAL_PSYCHE: EvePsyche = {
  knowledgeDesire: 20,
  prohibitionFear: 85,
  serpentTrust: 25,
};

// ---- 按 temptationProgress 给基础值 ----
function getBasePsyche(temptationProgress: number): EvePsyche {
  return {
    knowledgeDesire: INITIAL_PSYCHE.knowledgeDesire + temptationProgress * 20,
    prohibitionFear: INITIAL_PSYCHE.prohibitionFear - temptationProgress * 15,
    serpentTrust: INITIAL_PSYCHE.serpentTrust + temptationProgress * 10,
  };
}

// ---- 按 inputTag 微调 ----
// 语义线索评分系统对应：
// - promise_wisdom / self_judgement → tempt_wisdom → 好奇上升
// - challenge_prohibition / soften_death → weaken_fear → 戒惧下降
// - gentle_reframe → build_trust → 信任上升
// - direct_command → 信任下降、戒惧上升
const INPUT_TAG_ADJUSTMENTS: Record<InputTag, Partial<EvePsyche>> = {
  tempt_wisdom: { knowledgeDesire: 12 },
  weaken_fear: { prohibitionFear: -12 },
  build_trust: { serpentTrust: 12 },
  direct_command: { serpentTrust: -15, prohibitionFear: 10 },
  irrelevant: {},
};

// ---- clamp 工具 ----
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ---- 派生函数 ----
export function deriveEvePsyche(params: {
  temptationProgress: number;
  lastInputTag?: InputTag | null;
}): EvePsyche {
  const { temptationProgress, lastInputTag } = params;
  const base = getBasePsyche(temptationProgress);

  if (lastInputTag) {
    const adj = INPUT_TAG_ADJUSTMENTS[lastInputTag];
    return {
      knowledgeDesire: clamp(base.knowledgeDesire + (adj.knowledgeDesire ?? 0), 0, 100),
      prohibitionFear: clamp(base.prohibitionFear + (adj.prohibitionFear ?? 0), 0, 100),
      serpentTrust: clamp(base.serpentTrust + (adj.serpentTrust ?? 0), 0, 100),
    };
  }

  return {
    knowledgeDesire: clamp(base.knowledgeDesire, 0, 100),
    prohibitionFear: clamp(base.prohibitionFear, 0, 100),
    serpentTrust: clamp(base.serpentTrust, 0, 100),
  };
}

// ---- 心理状态短句派生 ----
// 用于玩家主界面，代替三条数值条

export function derivePsycheNarration(params: {
  temptationProgress: number;
  lastInputTag?: InputTag | null;
}): string {
  const { temptationProgress, lastInputTag } = params;

  // 根据 lastInputTag 微调
  if (lastInputTag === "direct_command") {
    return "她向后退了一步。";
  }
  if (lastInputTag === "irrelevant") {
    return "她困惑地望向草叶。";
  }
  if (lastInputTag === "build_trust") {
    return "她没有离开，仍在听。";
  }

  // 根据 temptationProgress
  if (temptationProgress >= 3) {
    return "她的手已经离果实很近。";
  }
  if (temptationProgress === 2) {
    return "她看向果树的时间变长了。";
  }
  if (temptationProgress === 1) {
    return "她开始在「不可吃」之外寻找原因。";
  }
  return "她仍把神的话放在最前面。";
}
