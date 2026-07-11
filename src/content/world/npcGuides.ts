// ============================================================
// 第一章 NPC 一次性主动引导（内容层）
//
// 每条引导有唯一 guideId，每局只触发一次。规则层先决定应注入哪条，
// 再将自然语言要求注入 Agent Prompt；fallback 必须有等价固定文案。
// 不暴露规则、数值或工具名。
// ============================================================

import type { EdenWorldState, EdenNpcId, WorldInputTag } from "@/game/world/types";
import { LOCATION_NAMES } from "@/content/world/locations";

export type NpcGuideCategory = "first_greeting" | "stagnation" | "relation_stage";

export type NpcGuide = {
  id: string;
  npcId: EdenNpcId;
  category: NpcGuideCategory;
  /** 注入 Prompt 的自然要求（不暴露规则/数值） */
  directive: string;
  /** 静态兜底对白 */
  fallback?: string;
  /** 动态兜底（基于当前状态，如女人所在地点） */
  dynamicFallback?: (state: EdenWorldState) => string;
  /** 是否应在当前状态触发（规则层判断，不修改状态） */
  shouldTrigger: (state: EdenWorldState, npcId: EdenNpcId, playerInput: string, inputTag: WorldInputTag) => boolean;
};

export const NPC_GUIDES: NpcGuide[] = [
  {
    id: "guide_adam_first_wife",
    npcId: "adam",
    category: "first_greeting",
    directive:
      "你正挂念妻子。自然地提起：你可曾看见我的妻子？她方才往东边的树林采果去了。让玩家知道该往东去寻找女人，但像日常说话，不要像任务提示。",
    dynamicFallback: (state) => {
      const eveLoc = state.npcLocations.eve;
      const place = LOCATION_NAMES[eveLoc] ?? "东边的树林";
      return `你可曾看见我的妻子？她方才往${place}采果去了。`;
    },
    shouldTrigger: (state) => !state.encounteredNpcIds.includes("adam"),
  },
  {
    id: "guide_michael_first",
    npcId: "michael",
    category: "first_greeting",
    directive: "你守伊甸之河。自然提醒：每句话离开口中后都会留下后果。",
    fallback: "记住，每句话离开口中后，都会留下后果。",
    shouldTrigger: (state) => !state.encounteredNpcIds.includes("michael"),
  },
  {
    id: "guide_gabriel_first",
    npcId: "gabriel",
    category: "first_greeting",
    directive: "你传言语。自然提醒：水流和声音可以把话带向别处。",
    fallback: "水流和声音，会把一句话带向别处。说出口，就不只属于你。",
    shouldTrigger: (state) => !state.encounteredNpcIds.includes("gabriel"),
  },
  {
    id: "guide_lucifer_first",
    npcId: "lucifer",
    category: "first_greeting",
    directive: "你坐在四河分流。用温和的反问自然提醒：每条水流都通向不同的远方，也许还有另一条路。",
    fallback: "你有没有想过，如果水往另一个方向流，会看见什么？",
    shouldTrigger: (state) => !state.encounteredNpcIds.includes("lucifer"),
  },
  {
    id: "guide_hedgehog_first",
    npcId: "hedgehog",
    category: "first_greeting",
    directive: "你是一只刺猬。用动作暗示保持安静、连续观察，不说人类长句。",
    fallback: "（刺猬竖起鼻子，轻轻示意你放轻脚步，安静地看。）",
    shouldTrigger: (state) => !state.encounteredNpcIds.includes("hedgehog"),
  },
  {
    id: "guide_eve_first",
    npcId: "eve",
    category: "first_greeting",
    directive: "你正被一道禁令困惑。自然暴露你最困惑的词，例如'死''知道''为什么'，但不要替自己下结论。",
    fallback: "神说不可吃，也不可摸，免得死亡。可我不明白——'死'是什么？'知道'又是什么？",
    shouldTrigger: (state) => !state.encounteredNpcIds.includes("eve"),
  },
];

export function getNpcGuideById(id: string): NpcGuide | null {
  return NPC_GUIDES.find((g) => g.id === id) ?? null;
}
