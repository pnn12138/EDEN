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
} from "@/game/world/types";
import { DIVINE_ATTENTION_NARRATIONS } from "@/game/world/types";
import type { WorldInputTag, WorldToolName } from "@/game/world/types";
import { EDEN_NPCS } from "@/content/world/npcs";

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k));
}

/** 计算神的注视增量（基于玩家输入 + 低语对象 + 环境，不含工具副作用） */
export function computeDivineAttentionDelta(params: {
  inputTag: WorldInputTag;
  locationId: EdenWorldState["locationId"];
  angelLocation: EdenLocationId | undefined;
  isStrongTemptation: boolean;
  divineAttention: DivineAttentionLevel;
  /** 低语对象（第二层 NPC 特定风险） */
  targetNpc?: EdenNpcId;
  /** 玩家原始输入（用于话题关键词触发） */
  playerInput?: string;
  /** 是否为夜晚低语（额外 +1） */
  isNight?: boolean;
  /** 是否在本轮低语使用晨星碎片（非满好感强化版，额外 +1） */
  usesLuciferStar?: boolean;
}): number {
  const {
    inputTag,
    locationId,
    angelLocation,
    isStrongTemptation,
    targetNpc,
    playerInput = "",
    isNight,
    usesLuciferStar,
  } = params;

  let delta = 0;

  // ---- 第一层：低语语义（核心，对齐 INTERACTION_LOGIC.md §五） ----
  switch (inputTag) {
    case "build_trust": // 温和提问 / 闲聊
      delta += 0;
      break;
    case "weaken_fear": // 弱化死亡恐惧
      delta += 1;
      break;
    case "tempt_wisdom": // 质疑禁令 / 许以智慧
      delta += isStrongTemptation ? 2 : 1; // 强诱导（提禁树）+2
      break;
    case "direct_command": // 命令 / 威胁女人 / 质疑神
      delta += 3;
      break;
    case "irrelevant": // 出戏现代词
      delta += 1;
      break;
  }

  // 夜晚低语额外 +1
  if (isNight) {
    delta += 1;
  }

  // 使用晨星碎片（非满好感强化版）额外 +1
  if (usesLuciferStar) {
    delta += 1;
  }

  // 在天使所在区域诱导 → 额外 +1（保留既有逻辑：天使守望区更危险）
  if (angelLocation && locationId === angelLocation && inputTag !== "irrelevant") {
    delta += 1;
  }

  // ---- 第二层：对谁说话 + 说什么（NPC 特定风险） ----
  const npc = targetNpc ? EDEN_NPCS[targetNpc] : undefined;
  const text = playerInput.toLowerCase();

  // 基础注视（如米迦勒每次低语被记录）
  if (npc && npc.attentionRisk) {
    delta += npc.attentionRisk;
  }

  // 话题关键词触发（仅在对应 NPC 身上生效）
  if (targetNpc === "michael") {
    // 提"禁树/善恶"或质疑"神为什么"再 +2
    if (includesAny(text, ["禁树", "善恶", "神为什么", "为什么神", "质疑神"])) {
      delta += 2;
    }
  } else if (targetNpc === "gabriel") {
    // 直接提"禁树" +1（他毕竟是信使）
    if (text.includes("禁树")) {
      delta += 1;
    }
  } else if (targetNpc === "adam") {
    // 讨论禁令 / 死亡 +1（禁令承载者，提及即强化禁忌可见性）
    if (includesAny(text, ["禁令", "死亡"])) {
      delta += 1;
    }
  }
  // 路西法：无额外（晨星碎片已在第一层处理）；女人：按第一层语义；刺猬：永远 0

  return delta;
}

/** 计算神的注视降低量（clamp 0-4，向下不穿透） */
export function computeDivineAttentionReduction(
  current: DivineAttentionLevel,
  amount: number,
): DivineAttentionLevel {
  return Math.max(0, current - amount) as DivineAttentionLevel;
}

/** 工具执行后补加的神的注视（仅 touch_fruit，手停在果子下方是真正的越界前兆） */
export function computeToolDivineAttentionDelta(triggeredTool: WorldToolName | undefined): number {
  if (triggeredTool === "touch_fruit") return 1;
  return 0;
}

/** 应用神的注视变化，返回新等级（clamp 0-4）。同时累计 divineAttentionCumulative（永不归零）。 */
export function applyDivineAttention(
  state: EdenWorldState,
  delta: number,
): DivineAttentionLevel {
  // 天眷·注视加速：已选 gift_attention_accel 时正向增量 ×1.5
  let effectiveDelta = delta;
  if (delta > 0 && state.divineGiftsOwned?.includes("gift_attention_accel")) {
    effectiveDelta = Math.round(delta * 1.5);
  }
  const next = Math.max(0, Math.min(4, state.divineAttention + effectiveDelta));
  state.divineAttention = next as DivineAttentionLevel;
  state.divineAttentionCumulative = Math.max(
    0,
    state.divineAttentionCumulative + effectiveDelta,
  );
  return state.divineAttention;
}

/** 获取神的注视叙事 */
export function getDivineAttentionNarration(level: DivineAttentionLevel): string {
  return DIVINE_ATTENTION_NARRATIONS[level];
}

/** 判断是否触发失败结局（第12时段结束仍未吃果） */
export function shouldTriggerGodArrives(state: EdenWorldState): boolean {
  if (state.isEnded) return false;
  // 第12时段结束仍未吃果，才触发失败
  return state.timeSlot >= 12 && !state.worldActions.hasEatenFruit;
}
