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
    id: "guide_fox_first",
    npcId: "fox",
    category: "first_greeting",
    directive: "你是拆解语言的高手。自然地提醒玩家：可以让你评价一句准备对女人说的话。像闲聊，不像教程。",
    fallback: "你若拿不准该怎么对她开口，不妨让我听听那句话的味道。",
    shouldTrigger: (state) => !state.encounteredNpcIds.includes("fox"),
  },
  {
    id: "guide_raphael_first",
    npcId: "raphael",
    category: "first_greeting",
    directive: "你安抚受惊的生灵。自然提醒：受惊的生灵听不见复杂的劝说，先让它安心。",
    fallback: "受惊的生灵，听不见复杂的劝说。先让它安心，话才进得去。",
    shouldTrigger: (state) => !state.encounteredNpcIds.includes("raphael"),
  },
  {
    id: "guide_uriel_first",
    npcId: "uriel",
    category: "first_greeting",
    directive: "你执光照。自然提醒：提问比断言更不容易惊动对方。",
    fallback: "提问比断言更不容易惊动对方——你越想说服，她越会缩回去。",
    shouldTrigger: (state) => !state.encounteredNpcIds.includes("uriel"),
  },
  {
    id: "guide_michael_first",
    npcId: "michael",
    category: "first_greeting",
    directive: "你执后果。自然提醒：每句话离开口中后都会留下后果。",
    fallback: "记住，每句话离开口中后，都会留下后果。",
    shouldTrigger: (state) => !state.encounteredNpcIds.includes("michael"),
  },
  {
    id: "guide_cherubim_first",
    npcId: "cherubim",
    category: "first_greeting",
    directive: "你守东园边界。自然提醒东园道路和边界，但不要直接给通关答案。",
    fallback: "东边的路通向树林，也通向门。门后是什么，要你自己看。",
    shouldTrigger: (state) => !state.encounteredNpcIds.includes("cherubim"),
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
  {
    id: "guide_watching_first",
    npcId: "watching_angel",
    category: "first_greeting",
    directive: "你沉默注视。自然提醒：被守护的东西若被靠近，会有后果，但不要吓唬。",
    fallback: "我守在这里，不为拦你，只为记住谁越过了边界。",
    shouldTrigger: (state) => !state.encounteredNpcIds.includes("watching_angel"),
  },
];

export function getNpcGuideById(id: string): NpcGuide | null {
  return NPC_GUIDES.find((g) => g.id === id) ?? null;
}
