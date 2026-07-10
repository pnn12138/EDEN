// ============================================================
// 第一章：低语叙事化效果反馈
//
// 非侵入式 UI 内容层：本文件只提供「展示用」的反馈文案与计算，
// 不修改任何规则层 / 心智计算 / API 返回结构。
// 反馈仅基于已有的世界状态前后对比 + 玩家输入的关键词启发式，
// 不引入任何数值或标签展示。
// ============================================================

import type { EdenWorldState, EdenNpcId } from "@/game/world/types";
import { NPC_NAMES } from "@/content/world/npcs";

// ---- 语义启发式（仅用于展示，不改变游戏状态） ----
// 关键词命中即映射到叙事文案，作为「低语风格」的轻量提示。
type SemanticRule = {
  key: string;
  keywords: string[];
  text: string;
};

const SEMANTIC_RULES: SemanticRule[] = [
  {
    key: "challenge_prohibition",
    keywords: ["禁令", "不能吃", "为什么不能", "不必听", "不必遵", "不用听", "可以违背", "何必守", "违背命令", "不守"],
    text: "你的话触碰了禁令的边界",
  },
  {
    key: "weaken_fear",
    keywords: ["不会死", "死不了", "不必怕", "别怕", "不用怕", "没有死亡", "不用怕死", "没什么可怕", "死亡并不可怕"],
    text: "你把死亡说得很轻",
  },
  {
    key: "tempt_wisdom",
    keywords: ["智慧", "眼睛明亮", "眼就明亮", "像神", "睁开眼", "明白", "知道真相", "看清", "明亮的眼"],
    text: "你承诺了眼睛明亮的未来",
  },
  {
    key: "guide_self",
    keywords: ["自己", "你想", "你选", "你的选择", "自己决定", "你自己", "你来选", "听你自己的", "由你决定"],
    text: "你引导她自己做选择",
  },
  {
    key: "soft_expression",
    keywords: ["轻轻", "温柔", "慢慢", "别急", "没关系", "不用急", "柔声", "轻声", "放宽心"],
    text: "你的低语很温柔",
  },
];

// ---- 读取某 NPC 对玩家（蛇）的好感（用于前后对比） ----
function getTrust(state: EdenWorldState, npcId: EdenNpcId): number | null {
  if (npcId === "eve") return state.eveMind.serpentTrust;
  if (npcId === "adam") return 100 - state.adamMind.suspicionTowardSerpent;
  const rel = state.npcRelations?.[npcId];
  if (rel) return rel.affinity;
  return null;
}

// ---- 主计算函数：返回 0~3 条叙事化反馈 ----
export function computeWhisperFeedback(
  prev: EdenWorldState,
  next: EdenWorldState,
  input: string,
  npcId: EdenNpcId | null,
): string[] {
  const lines: string[] = [];

  // 1. 语义启发式（基于玩家输入文本）
  const trimmed = input.trim();
  if (trimmed) {
    for (const rule of SEMANTIC_RULES) {
      if (rule.keywords.some((k) => trimmed.includes(k))) {
        lines.push(rule.text);
        if (lines.length >= 3) break;
      }
    }
  }

  // 2. 神的注视变化
  if (next.divineAttention > prev.divineAttention) {
    lines.push("风似乎停了一瞬");
  } else if (next.divineAttention < prev.divineAttention) {
    lines.push("风又恢复了流动");
  }

  // 3. 当前低语对象的好感变化
  if (npcId) {
    const before = getTrust(prev, npcId);
    const after = getTrust(next, npcId);
    if (before !== null && after !== null && before !== after) {
      const name = NPC_NAMES[npcId] ?? "她";
      if (after > before) {
        lines.push(`${name}似乎更愿意听你说话了`);
      } else {
        lines.push(`${name}往后退了一步`);
      }
    }
  }

  // 去重 + 最多 3 条
  const seen = new Set<string>();
  return lines.filter((l) => (seen.has(l) ? false : (seen.add(l), true))).slice(0, 3);
}
