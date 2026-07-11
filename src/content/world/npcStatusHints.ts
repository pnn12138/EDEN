// ============================================================
// 第一章：NPC 状态提示叙事化文案
//
// 非侵入式 UI 内容层：本文件只提供「展示用」的状态映射文案，
// 不修改任何规则层 / 心智计算 / 状态字段。
// 映射仅基于已有的世界状态数值，不显示数值、字段名或公式。
// ============================================================

import type { EdenWorldState, EdenNpcId } from "@/game/world/types";
import { NPC_NAMES } from "@/content/world/npcs";

// ---- 天使类 NPC（使用 guarding / 试炼语义） ----
const ANGEL_IDS = new Set<EdenNpcId>([
  "gabriel",
  "michael",
  "lucifer",
]);

// ---- 敬畏 / 对神命令信仰 ----
function faithLine(name: string, value: number): string {
  if (value > 70) return `${name}对神的命令心怀敬畏`;
  if (value >= 40) return `${name}对禁令有些犹豫`;
  return `${name}开始质疑命令的意义`;
}

// ---- 好感 / 对玩家（蛇）的信任 ----
function trustLine(name: string, value: number): string {
  if (value > 70) return `${name}愿意听你说话`;
  if (value >= 40) return `${name}对你将信将疑`;
  return `${name}不太信任你`;
}

// ---- 刺猬：用 mood 字段映射 ----
function hedgehogMoodLine(mood: string): string {
  switch (mood) {
    case "curious":
      return "刺猬很好奇";
    case "alert":
      return "刺猬很警惕";
    case "hiding":
      return "刺猬躲起来了";
    default:
      return "刺猬看起来很放松";
  }
}

// ---- 天使：审查 / 兴趣 ----
function angelLine(name: string, affinity: number, challengePassed: boolean): string {
  if (challengePassed) return `${name}已通过你的试炼，目光温和了些`;
  if (affinity > 70) return `${name}对你产生了兴趣`;
  if (affinity >= 40) return `${name}在观察你的话语`;
  return `${name}对你持审视态度`;
}

/**
 * 返回 NPC 的叙事化状态提示（最多 2 条）。
 * 不显示任何数值或字段名。
 */
export function getNpcStatusHint(
  state: EdenWorldState,
  npcId: EdenNpcId | null,
): string[] {
  if (!npcId) return [];
  const name = NPC_NAMES[npcId] ?? "对方";

  // 刺猬：专属 mood 映射
  if (npcId === "hedgehog") {
    return [hedgehogMoodLine(state.hedgehog?.mood ?? "idle")];
  }

  // 夏娃：三维度心智（信仰 + 好感）
  if (npcId === "eve") {
    return [
      faithLine(name, state.eveMind.obedience),
      trustLine(name, state.eveMind.serpentTrust),
    ];
  }

  // 亚当：对神信仰 + 对蛇信任（100 - 怀疑）
  if (npcId === "adam") {
    return [
      faithLine(name, state.adamMind.obedience),
      trustLine(name, 100 - state.adamMind.suspicionTowardSerpent),
    ];
  }

  // 天使类：审查 / 兴趣 + 好感
  if (ANGEL_IDS.has(npcId)) {
    const rel = state.npcRelations?.[npcId];
    const affinity = rel?.affinity ?? 100;
    const challengePassed = state.npcChallenges?.[npcId]?.status === "passed";
    return [angelLine(name, affinity, challengePassed), trustLine(name, affinity)];
  }

  // 其他可对话 NPC：仅好感线
  const rel = state.npcRelations?.[npcId];
  const affinity = rel?.affinity ?? 100;
  return [trustLine(name, affinity)];
}
