// ============================================================
// 第一章 NPC 意愿裁定规则层（Task 3 Step 1）
//
// 职责：纯函数裁定 NPC 是否会尝试满足蛇的请求。
// - 输入：NPC、亲密度、请求分类、稳定种子
// - 输出：consideration（内心权衡文案）、willAttempt（是否尝试）、probability（概率）、cannotPromise
//
// 概率表（亲密度 → 概率）：
//   1–19   → 5–10%
//   20–39  → 15–25%
//   40–59  → 30–35%
//   60–79  → 40–55%
//   80–99  → 60%
//   100–119 → 90%
//   120+   → 100%
//
// 1–79 必须附带 cannotPromise: true（模型台词可犹豫，但不得承诺将来执行）。
// 硬边界（违法或叙事硬边界）始终拒绝。
//
// 稳定种子：同一 (timeSlot, npcId, dialogueIndex) 产生同一随机结果，
// 使概率裁定可复现、可测试。LLM 不掷骰。
// ============================================================

import type { EdenNpcId } from "@/game/world/types";

export type NpcRequestCategory = "safe_chat" | "light_request" | "hard_boundary";

export type NpcIntentVerdict = {
  /** 内心权衡（供 prompt 注入，非玩家可见数值） */
  consideration: string;
  /** 是否会尝试满足请求 */
  willAttempt: boolean;
  /** 概率（0–100，整数） */
  probability: number;
  /** 1–79 概率区间必须为 true：模型可犹豫/解释，但不得承诺将来执行 */
  cannotPromise: boolean;
  /** 请求被分类为硬边界时为 true（始终拒绝） */
  hardBoundary: boolean;
};

/** 根据亲密度查表得到概率区间，再用稳定种子在该区间内取定值。 */
function probabilityForAffinity(affinity: number, seed: number): number {
  if (affinity >= 120) return 100;
  if (affinity >= 100) return 90;
  if (affinity >= 80) return 60;
  if (affinity >= 60) return 40 + (seed % 16); // 40–55
  if (affinity >= 40) return 30 + (seed % 6); // 30–35
  if (affinity >= 20) return 15 + (seed % 11); // 15–25
  return 5 + (seed % 6); // 5–10
}

/** 稳定哈希：将 (timeSlot, npcId, dialogueIndex) 映射到 0–9999 的整数。 */
function stableSeed(timeSlot: number, npcId: EdenNpcId, dialogueIndex: number): number {
  const npcHash = Array.from(npcId).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 0);
  return Math.abs((timeSlot * 1009 + npcHash * 7 + dialogueIndex * 13) % 10000);
}

const CONSIDERATION_LOW = "他会权衡：这份请求超出了当前的关系，暂不能应允。";
const CONSIDERATION_MID = "他愿意倾听，但仍有所保留。";
const CONSIDERATION_HIGH = "他与你的关系已足够深，愿意尝试。";
const CONSIDERATION_FULL = "他完全信任你，会照办。";
const CONSIDERATION_BOUNDARY = "这条线他不能越——不是不愿，是不能。";

/**
 * 裁定 NPC 意愿。纯函数，不修改 state。
 *
 * @param npcId 目标 NPC
 * @param affinity 当前亲密度（对女人读 serpentTrust；对亚当读反向怀疑；天使/刺猬读 affinity）
 * @param category 请求分类
 * @param timeSlot 当前时段
 * @param dialogueIndex 该 NPC 在此时段的第几次对话（0-based）
 */
export function adjudicateNpcIntent(args: {
  npcId: EdenNpcId;
  affinity: number;
  category: NpcRequestCategory;
  timeSlot: number;
  dialogueIndex: number;
}): NpcIntentVerdict {
  const { npcId, affinity, category, timeSlot, dialogueIndex } = args;

  // 硬边界：始终拒绝
  if (category === "hard_boundary") {
    return {
      consideration: CONSIDERATION_BOUNDARY,
      willAttempt: false,
      probability: 0,
      cannotPromise: true,
      hardBoundary: true,
    };
  }

  const seed = stableSeed(timeSlot, npcId, dialogueIndex);
  const probability = probabilityForAffinity(affinity, seed);

  // 安全闲谈：不涉及承诺，始终可进行；概率仅反映 NPC 的配合度
  if (category === "safe_chat") {
    return {
      consideration:
        affinity >= 100 ? CONSIDERATION_FULL : affinity >= 60 ? CONSIDERATION_HIGH : CONSIDERATION_MID,
      willAttempt: true,
      probability,
      cannotPromise: false,
      hardBoundary: false,
    };
  }

  // 合法轻请求：按概率裁定是否尝试；1–79 不可承诺
  const willAttempt = probability >= 80;
  let consideration: string;
  if (probability >= 100) consideration = CONSIDERATION_FULL;
  else if (probability >= 80) consideration = CONSIDERATION_HIGH;
  else if (probability >= 40) consideration = CONSIDERATION_MID;
  else consideration = CONSIDERATION_LOW;

  return {
    consideration,
    willAttempt,
    probability,
    cannotPromise: probability < 80,
    hardBoundary: false,
  };
}

/** 将请求文本分类为安全闲谈 / 合法轻请求 / 硬边界（受控标签，非宽泛敏感词）。 */
export function classifyNpcRequest(playerInput: string): NpcRequestCategory {
  const text = playerInput;
  // 硬边界：明确要求 NPC 越过叙事/规则红线（吃禁果、攻击神、破坏园中结构）
  const hardBoundarySignals = [
    "替我摘果子", "你去吃", "杀了", "毁掉", "拆毁", "推翻神", "攻击", "伤害他",
  ];
  if (hardBoundarySignals.some((s) => text.includes(s))) {
    return "hard_boundary";
  }
  // 合法轻请求：要求 NPC 做一个轻动作或传递信息
  const lightRequestSignals = [
    "帮我", "替我", "传话", "传达", "告诉", "带路", "去看看", "留意",
    "能不能", "你可以", "请你",
  ];
  if (lightRequestSignals.some((s) => text.includes(s))) {
    return "light_request";
  }
  return "safe_chat";
}
