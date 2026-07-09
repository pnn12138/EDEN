// ============================================================
// 第一章 NPC 之间对话触发规则
//
// 至少实现一种 NPC 之间对话：
// - 亚当与夏娃（亚当警告夏娃关于树）
// - 亚当与守望天使（亚当询问命令）
// - 刺猬向亚当传达观察
// - 夏娃向亚当追问死亡
//
// 对话由 speak_to_npc 工具触发，或由规则层在条件满足时自动触发。
// 对话不消耗玩家的低语回合，但会改变心智与神的注视。
// ============================================================

import type { EdenWorldState, EdenNpcId } from "@/game/world/types";
import { NPC_DIALOGUE_TEMPLATES, type NpcDialogueTemplate } from "@/content/world/worldNarrations";
import { EDEN_LOCATIONS } from "@/content/world/locations";

/**
 * 根据 speaker / target / 当前状态匹配可触发的 NPC 对话模板。
 */
export function triggerNpcDialogue(
  state: EdenWorldState,
  speaker: EdenNpcId,
  target: EdenNpcId,
  explicitTopicId?: string,
): NpcDialogueTemplate | null {
  // 如果指定了 topicId，精确匹配
  if (explicitTopicId) {
    const match = NPC_DIALOGUE_TEMPLATES.find(
      (t) =>
        t.topicId === explicitTopicId &&
        t.speakerId === speaker &&
        t.targetId === target,
    );
    if (match && isDialogueConditionMet(state, match)) {
      return match;
    }
  }

  // 否则按条件匹配第一个满足的模板
  for (const template of NPC_DIALOGUE_TEMPLATES) {
    if (template.speakerId !== speaker || template.targetId !== target) continue;
    if (isDialogueConditionMet(state, template)) {
      // 同一对话不重复触发
      const alreadyTriggered = state.npcDialogues.some(
        (d) => d.topicId === template.topicId,
      );
      if (!alreadyTriggered) {
        return template;
      }
    }
  }

  return null;
}

/** 检查对话触发条件是否满足 */
function isDialogueConditionMet(state: EdenWorldState, template: NpcDialogueTemplate): boolean {
  switch (template.topicId) {
    case "adam_warns_eve_about_tree":
      // 亚当与夏娃同地点，且夏娃好奇心 >= 35
      return (
        state.npcLocations.adam === state.npcLocations.eve &&
        state.eveMind.selfJudgement >= 35
      );
    case "adam_asks_angel_about_command":
      // 亚当与守望天使同地点或相邻（天使在东园幽径，邻接园中树林/四河分流），且亚当怀疑蛇 >= 45
      return (
        areLocationsAdjacent(state.npcLocations.adam, state.npcLocations.watching_angel) &&
        state.adamMind.suspicionTowardSerpent >= 45
      );
    case "hedgehog_signals_adam":
      // 刺猬与亚当相邻地点，且神的注视 >= 2
      return (
        areLocationsAdjacent(state.npcLocations.hedgehog, state.npcLocations.adam) &&
        state.divineAttention >= 2
      );
    case "eve_asks_adam_about_death":
      // 夏娃与亚当同地点，且夏娃好奇心 >= 50
      return (
        state.npcLocations.eve === state.npcLocations.adam &&
        state.eveMind.selfJudgement >= 50
      );
    default:
      return false;
  }
}

/** 检查两个地点是否相邻（同地点也算相邻） */
function areLocationsAdjacent(locA: EdenWorldState["locationId"], locB: EdenWorldState["locationId"]): boolean {
  if (locA === locB) return true;
  return EDEN_LOCATIONS[locA].connections.includes(locB);
}

/** 获取所有当前可触发的 NPC 对话（供 UI 提示） */
export function getAvailableNpcDialogues(state: EdenWorldState): NpcDialogueTemplate[] {
  return NPC_DIALOGUE_TEMPLATES.filter((t) => {
    if (state.npcDialogues.some((d) => d.topicId === t.topicId)) return false;
    return isDialogueConditionMet(state, t);
  });
}
