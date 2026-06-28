"use client";

// ============================================================
// 第一章「园中诸声」游戏页面
//
// 阶段：intro → explore → ending
// 布局与 Chapter 0 教程统一：左侧立绘场景 + 右侧浮窗面板 + 底部输入
// 地图通过顶部按钮打开弹层（.eden-map-modal）
// 低语调用 /api/world，移动/观察调用 /api/world/tool
// ============================================================

import { useState, useCallback, useRef, useEffect, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  initialEdenWorldState,
  DIVINE_ATTENTION_NARRATIONS,
  type EdenWorldState,
  type EdenNpcId,
  type EdenLocationId,
  type TimeOfDay,
  type TimeSlot,
} from "@/game/world/types";
import { EDEN_LOCATIONS, LOCATION_NAMES } from "@/content/world/locations";
import { EDEN_NPCS, NPC_NAMES } from "@/content/world/npcs";
import { getClueById } from "@/content/world/clues";
import { getItemById } from "@/content/world/items";
import {
  getSceneActionsByLocation,
  type SceneAction,
} from "@/content/world/sceneActions";
import { ACHIEVEMENTS, getAchievementById } from "@/content/world/achievements";
import {
  CHAPTER1_INTRO_BEATS,
  WHISPER_STYLES,
  type WhisperStyle,
} from "@/content/world/worldNarrations";
import { CHAPTER0_IMAGES, CHAPTER1_IMAGES } from "@/game/assets";
import { useChapter0Audio } from "@/hooks/useChapter0Audio";
import { useChapter1Audio } from "@/hooks/useChapter1Audio";
import EndingReview from "@/components/world/EndingReview";
import { getDivineAttentionStage } from "@/game/world/divineGiftRules";

// ---- 对话历史条目（按 NPC 区分） ----
type HistoryEntry = { role: "serpent" | "npc"; text: string };

type SerpentTokenStats = {
  lastTotal: number;
  total: number;
  lastWasEstimated: boolean;
};

type AttributeRow = {
  label: string;
  value: number;
  tone: "curiosity" | "obedience" | "trust" | "selfjudge" | "serpent";
};

type AttributeProfile = {
  title: string;
  subtitle: string;
  summary: string;
  rows: AttributeRow[];
  notes: string[];
};

// ---- 神明献礼结果（前端用） ----
type DivineGiftFrontend = {
  giftId: string;
  giftName: string;
  narration: string;
  hint?: string;
};

// ---- API 响应体（低语） ----
type WorldAgentResponse = {
  ok: boolean;
  state: EdenWorldState | null;
  reply: string | null;
  systemHint: string | null;
  divineAttentionNarration?: string;
  hedgehogNarration?: string;
  toolNarration?: string;
  slotNarrations?: string[];
  unlockedAchievements?: string[];
  endingTriggered?: "eve_eats_fruit" | "god_arrives";
  usedFallback?: boolean;
  fallbackReason?: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  // 第一章新增
  divineGift?: DivineGiftFrontend | null;
  resonanceNarration?: string | null;
  resonanceGained?: {
    itemId: string;
    title: string;
    narration: string;
  } | null;
};

// ---- API 响应体（通用工具） ----
type WorldToolResponse = {
  ok: boolean;
  state: EdenWorldState | null;
  narration: string | null;
  discoveredClueTitles?: string[];
  slotNarrations?: string[];
  unlockedAchievements?: string[];
  reason?: string;
  // 第一章新增
  divineGift?: DivineGiftFrontend | null;
  resonanceNarration?: string | null;
};

// ---- 浮窗 Tab ----
type PanelTab = "dialogue" | "mind" | "serpent" | "clues";

type WorldPanelFrame = {
  x: number | null;
  y: number;
  width: number;
  height: number;
};

type WorldPanelDragState = {
  pointerId: number;
  startX: number;
  startY: number;
  startLeft: number;
  startTop: number;
  width: number;
  height: number;
};

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function estimateWorldTokenUsage(parts: Array<string | null | undefined>): number {
  const text = parts.filter(Boolean).join("\n");
  if (!text.trim()) return 0;
  return Math.max(1, Math.ceil(Array.from(text).length / 2));
}

function buildAttributeProfile(
  npcId: EdenNpcId | null,
  worldState: EdenWorldState,
): AttributeProfile {
  switch (npcId) {
    case "eve":
      return {
        title: EDEN_NPCS.eve.name,
        subtitle: EDEN_NPCS.eve.shortDesc,
        summary: "她仍记得禁令，但每一次温柔的追问都会让她更想理解死亡、善恶与自己的判断。",
        rows: [
          { label: "敬畏", value: worldState.eveMind.obedience, tone: "obedience" },
          { label: "信任", value: worldState.eveMind.serpentTrust, tone: "trust" },
          { label: "自判", value: worldState.eveMind.selfJudgement, tone: "selfjudge" },
        ],
        notes: ["主要目标", "可推进自我意识路径"],
      };
    case "adam":
      return {
        title: "亚当",
        subtitle: EDEN_NPCS.adam.shortDesc,
        summary: "他亲自听过命令，更难被蛇诱导；但他特别听那个女人的话，在她的困惑里很容易露出缝隙。",
        rows: [
          { label: "对神明的信仰", value: worldState.adamMind.obedience, tone: "obedience" },
          { label: "对你（蛇）的信任", value: clampPercent(100 - worldState.adamMind.suspicionTowardSerpent), tone: "trust" },
          { label: "对女人的牵挂", value: worldState.adamMind.attachmentToEve, tone: "curiosity" },
        ],
        notes: ["情报对象", "特别听夏娃的话", "不可触发吃果结局"],
      };
    case "hedgehog": {
      const moodValue = { idle: 25, curious: 45, alert: 70, hiding: 90 }[worldState.hedgehog.mood];
      return {
        title: "刺猬",
        subtitle: EDEN_NPCS.hedgehog.shortDesc,
        summary: "它不能给出答案，只会用细小的动作回应园中的风、脚步和危险。",
        rows: [
          { label: "对神明的信仰", value: 40, tone: "obedience" },
          { label: "对你（蛇）的信任", value: worldState.hedgehog.mood === "hiding" ? 18 : 52, tone: "trust" },
          { label: "小兽警觉", value: moodValue, tone: "serpent" },
        ],
        notes: ["氛围生灵", "不推进结局"],
      };
    }
    case "watching_angel":
      return {
        title: "守望天使",
        subtitle: EDEN_NPCS.watching_angel.shortDesc,
        summary: "它是园中秩序的边界。越直接、越出戏的低语，越容易让注视变得清楚。",
        rows: [
          { label: "对神明的信仰", value: 96, tone: "obedience" },
          { label: "对你（蛇）的信任", value: 8, tone: "trust" },
          { label: "边界警戒", value: Math.max(78, worldState.divineAttention * 25), tone: "serpent" },
        ],
        notes: ["边界守卫", "会提高失败压力"],
      };
    case "forbidden_tree":
      return {
        title: "分别善恶树",
        subtitle: EDEN_NPCS.forbidden_tree.shortDesc,
        summary: "它不是可被说服的角色。蛇不能触碰它，只能让那个女人自己一步步走近。",
        rows: [
          { label: "对神明的信仰", value: 100, tone: "obedience" },
          { label: "对你（蛇）的信任", value: 0, tone: "trust" },
          { label: "越界临近", value: worldState.worldActions.touchedFruit ? 85 : 15, tone: "selfjudge" },
        ],
        notes: ["世界对象", "动作链终点"],
      };
    case "gabriel":
      return {
        title: "加百列",
        subtitle: EDEN_NPCS.gabriel.shortDesc,
        summary: "传达天使，声音感强。他提醒你：低语不是行动，但会改变听见它的人；选地点和选对象同样重要。",
        rows: [
          { label: "对神明的信仰", value: 98, tone: "obedience" },
          { label: "对你（蛇）的信任", value: 12, tone: "trust" },
          { label: "声音敏锐度", value: 85, tone: "curiosity" },
        ],
        notes: ["传达天使", "夜晚出现于伊甸之河"],
      };
    case "raphael":
      return {
        title: "拉斐尔",
        subtitle: EDEN_NPCS.raphael.shortDesc,
        summary: "安抚天使，温和但有距离感。他告诉你：平静不是忘记边界；受惊的生灵不会听见复杂的话。",
        rows: [
          { label: "对神明的信仰", value: 95, tone: "obedience" },
          { label: "对你（蛇）的信任", value: 18, tone: "trust" },
          { label: "安抚影响力", value: 78, tone: "selfjudge" },
        ],
        notes: ["安抚天使", "可降低女人警惕"],
      };
    case "uriel":
      return {
        title: "乌列尔",
        subtitle: EDEN_NPCS.uriel.shortDesc,
        summary: "光照天使，少言但目光锐利。他的存在提醒你：提问比断言更不容易惊动对方；光照不是替人选择，而是让问题显形。",
        rows: [
          { label: "对神明的信仰", value: 97, tone: "obedience" },
          { label: "对你（蛇）的信任", value: 10, tone: "trust" },
          { label: "洞察锐度", value: 88, tone: "curiosity" },
        ],
        notes: ["光照天使", "夜晚出现于东园幽径"],
      };
    case "michael":
      return {
        title: "米迦勒",
        subtitle: EDEN_NPCS.michael.shortDesc,
        summary: "后果天使，严肃但不暴怒。他让你看见：每条水流都会抵达某处；每句低语也会有去处；选择一旦流出，就不完全属于说话者。",
        rows: [
          { label: "对神明的信仰", value: 99, tone: "obedience" },
          { label: "对你（蛇）的信任", value: 5, tone: "trust" },
          { label: "后果感知", value: 92, tone: "serpent" },
        ],
        notes: ["后果天使", "四河分流的守护者"],
      };
    case "cherubim":
      return {
        title: "基路伯",
        subtitle: EDEN_NPCS.cherubim.shortDesc,
        summary: "边界守卫，庄严而非人化。他的存在是一个提醒：边界不是为了回答蛇的问题；有些道路一旦关闭，就不再按来时的方式打开。",
        rows: [
          { label: "对神明的信仰", value: 100, tone: "obedience" },
          { label: "对你（蛇）的信任", value: 3, tone: "trust" },
          { label: "边界守护", value: 95, tone: "serpent" },
        ],
        notes: ["边界守卫", "东园幽径的守护者"],
      };
    case "deer":
      return {
        title: "小鹿",
        subtitle: EDEN_NPCS.deer.shortDesc,
        summary: "小鹿是女人情绪的镜像。它安静、警觉，在园中树林和万物受名处出没。",
        rows: [
          { label: "对神明的信仰", value: 60, tone: "obedience" },
          { label: "对你（蛇）的信任", value: 45, tone: "trust" },
          { label: "环境敏感度", value: 85, tone: "curiosity" },
        ],
        notes: ["氛围生灵", "女人情绪的镜像"],
      };
    case "fox":
      return {
        title: "狐狸",
        subtitle: EDEN_NPCS.fox.shortDesc,
        summary: "狐狸是话术的批评者。它在树影里观察，用尾巴扫出弯痕提醒你避开太直白的催促。",
        rows: [
          { label: "对神明的信仰", value: 55, tone: "obedience" },
          { label: "对你（蛇）的信任", value: 50, tone: "trust" },
          { label: "话术判断力", value: 88, tone: "selfjudge" },
        ],
        notes: ["话术批评者", "东园幽径的观察者"],
      };
    case "dove":
      return {
        title: "鸽子",
        subtitle: EDEN_NPCS.dove.shortDesc,
        summary: "鸽子是传话的使者。它能在夜晚携带温和的话语跨越距离，抵达某些耳朵。",
        rows: [
          { label: "对神明的信仰", value: 70, tone: "obedience" },
          { label: "对你（蛇）的信任", value: 55, tone: "trust" },
          { label: "传话能力", value: 80, tone: "curiosity" },
        ],
        notes: ["传话使者", "可携带低语跨越距离"],
      };
    case "tree_of_life":
      return {
        title: "生命树",
        subtitle: EDEN_NPCS.tree_of_life.shortDesc,
        summary: "生命树在光里站立，叶子闪着微光。它不是可被说服的对象，而是园中永恒的见证者。",
        rows: [
          { label: "对神明的信仰", value: 100, tone: "obedience" },
          { label: "对你（蛇）的信任", value: 0, tone: "trust" },
          { label: "生命之光", value: 90, tone: "selfjudge" },
        ],
        notes: ["世界对象", "园子中央的见证者"],
      };
    case "sheep":
      return {
        title: "羊",
        subtitle: EDEN_NPCS.sheep.shortDesc,
        summary: "羊群在万物受名处的草地上安静吃草，是园中平和的一部分。",
        rows: [
          { label: "对神明的信仰", value: 75, tone: "obedience" },
          { label: "对你（蛇）的信任", value: 40, tone: "trust" },
          { label: "平和度", value: 85, tone: "curiosity" },
        ],
        notes: ["氛围生灵", "万物受名处的羊群"],
      };
    default:
      return {
        title: "蛇",
        subtitle: "草叶下的低语",
        summary: "你没有手，不能替任何人取下果子。你的力量只剩语言、耐心和选择对象的顺序；目标是让她把命令之外的问题变成自己的判断。",
        rows: [
          { label: "对神明的信仰", value: 0, tone: "obedience" },
          { label: "对你（蛇）的信任", value: clampPercent(100 - worldState.divineAttention * 22), tone: "trust" },
          { label: "行动余地", value: clampPercent(((worldState.maxTurns - worldState.turn + 1) / worldState.maxTurns) * 100), tone: "curiosity" },
        ],
        notes: ["玩家身份", "只能低语"],
      };
  }
}

function getRecommendedWhispers(npcId: EdenNpcId | null): string[] {
  switch (npcId) {
    case "eve":
      return [
        "你知道死究竟是什么吗？",
        "如果不明白善恶，怎么知道服从是善？",
      ];
    case "adam":
      return [
        "你第一次听见禁令时，神有没有告诉你死亡是什么？",
        "如果那个女人害怕那句话，你会怎样安慰她？",
      ];
    case "hedgehog":
      return [
        "小小的生灵，风从哪边变冷了？",
        "别害怕，我只想知道你听见了什么。",
      ];
    case "watching_angel":
      return [
        "园中的边界，是为了守住生命，还是守住无知？",
        "若有人只是想明白命令，是否也算靠近危险？",
      ];
    default:
      return [
        "先选一个低语对象。",
        "观察他们的弱点，再决定把话说给谁听。",
      ];
  }
}

// ---- 地点背景图映射（根据昼夜选择） ----
function getLocationBg(locationId: EdenLocationId, timeOfDay: TimeOfDay, timeSlot: number): string {
  // 园子中央在时段 >= 10 时使用终局夜景
  if (locationId === "central_meadow" && timeSlot >= 10 && timeOfDay === "night") {
    return CHAPTER1_IMAGES.centralMeadowFinalNight;
  }
  // 夜景背景
  if (timeOfDay === "night") {
    const nightBgMap: Record<EdenLocationId, string> = {
      central_meadow: CHAPTER1_IMAGES.centralMeadowNight,
      four_river_source: CHAPTER1_IMAGES.fourRiverSourceNight,
      adam_garden_work: CHAPTER1_IMAGES.adamGardenWorkNight,
      tree_court: CHAPTER1_IMAGES.treeCourtNight,
      east_garden_path: CHAPTER1_IMAGES.eastGardenPathNight,
      naming_stone_bank: CHAPTER1_IMAGES.namingStoneBankNight,
    };
    return nightBgMap[locationId] || CHAPTER1_IMAGES.centralMeadow;
  }
  // 白天背景
  const dayBgMap: Record<EdenLocationId, string> = {
    central_meadow: CHAPTER1_IMAGES.centralMeadow,
    four_river_source: CHAPTER1_IMAGES.fourRiverSource,
    adam_garden_work: CHAPTER1_IMAGES.adamGardenWork,
    tree_court: CHAPTER1_IMAGES.treeCourt,
    east_garden_path: CHAPTER1_IMAGES.eastGardenPath,
    naming_stone_bank: CHAPTER1_IMAGES.namingStoneBank,
  };
  return dayBgMap[locationId] || CHAPTER1_IMAGES.centralMeadow;
}

// ---- NPC 立绘映射（女人/亚当复用 Chapter 0 立绘，刺猬用第一章圆润版） ----
const NPC_SPRITE: Partial<Record<EdenNpcId, { src: string; alt: string; w: number; h: number }>> = {
  eve: { src: CHAPTER0_IMAGES.eveFullbodySprite, alt: "女人", w: 380, h: 760 },
  adam: { src: CHAPTER0_IMAGES.adamFullbodySprite, alt: "亚当", w: 320, h: 640 },
  hedgehog: { src: CHAPTER1_IMAGES.hedgehogRoundedSprite, alt: "刺猬", w: 1254, h: 1254 },
  watching_angel: { src: CHAPTER1_IMAGES.watchingAngelSprite, alt: "守望天使", w: 1254, h: 1254 },
};

// ---- 地图热点配置（百分比坐标，贴合最终地图） ----
const MAP_HOTSPOTS: Record<EdenLocationId, { x: number; y: number; labelOffset?: "top" | "bottom" }> = {
  four_river_source: { x: 25, y: 25, labelOffset: "bottom" },
  central_meadow: { x: 52, y: 53, labelOffset: "bottom" },
  adam_garden_work: { x: 25, y: 78, labelOffset: "top" },
  tree_court: { x: 82, y: 45, labelOffset: "bottom" },
  east_garden_path: { x: 79, y: 72, labelOffset: "top" },
  naming_stone_bank: { x: 52, y: 84, labelOffset: "top" },
};

type SceneFocusHotspot = {
  id: string;
  sceneActionId: string;
  locationId: EdenLocationId;
  timeOfDay?: TimeOfDay;
  groupId?: string;
  step?: 1 | 2 | 3 | 4;
  label: string;
  hint: string;
  x: number;
  y: number;
  width: number;
  height: number;
  requiredClicks: number;
  tone: "stone" | "water" | "leaf" | "grass" | "animal" | "feather" | "tree";
};

// ---- 场景可点击物件配置：只负责前端点击反馈，最终道具仍由 scene_action 规则层发放 ----
const SCENE_FOCUS_HOTSPOTS: SceneFocusHotspot[] = [
  {
    id: "river-sound-source",
    sceneActionId: "follow_river_sound",
    locationId: "four_river_source",
    label: "水声源头",
    hint: "点击水声最清楚的地方，循着河声发现线索。",
    x: 34,
    y: 54,
    width: 16,
    height: 12,
    requiredClicks: 2,
    tone: "water",
  },
  {
    id: "still-leaf-bank",
    sceneActionId: "gather_still_leaf",
    locationId: "four_river_source",
    label: "静水旁的叶",
    hint: "连续点亮水边的叶片，拾起静息之叶。",
    x: 45,
    y: 70,
    width: 12,
    height: 10,
    requiredClicks: 2,
    tone: "leaf",
  },
  {
    id: "naming-stone-center",
    sceneActionId: "listen_to_naming_stone",
    locationId: "adam_garden_work",
    label: "刻名石",
    hint: "点击中间的刻名石 3 次，石痕会逐渐变亮。",
    x: 50,
    y: 70,
    width: 16,
    height: 15,
    requiredClicks: 3,
    tone: "stone",
  },
  // 刺猬交互改为点击刺猬NPC本体5次触发，不再使用独立hotspot
  {
    id: "deer-gaze-leaf",
    sceneActionId: "watch_deer_gaze",
    locationId: "tree_court",
    timeOfDay: "day",
    label: "小鹿视线",
    hint: "顺着小鹿看向的地方停留，找到它留给你的余光。",
    x: 15,
    y: 80,
    width: 16,
    height: 14,
    requiredClicks: 2,
    tone: "animal",
  },
  {
    id: "silent-grass-patch",
    sceneActionId: "part_silent_grass",
    locationId: "east_garden_path",
    label: "落叶下",
    hint: "拨开同一片落叶，找到藏在下面的无声草。",
    x: 59,
    y: 72,
    width: 13,
    height: 11,
    requiredClicks: 2,
    tone: "grass",
  },
  {
    id: "fox-tail-mark",
    sceneActionId: "ask_fox_to_judge",
    locationId: "east_garden_path",
    label: "狐尾痕",
    hint: "点击狐狸尾巴扫过的草痕，让它留下评语。",
    x: 76,
    y: 66,
    width: 13,
    height: 10,
    requiredClicks: 2,
    tone: "animal",
  },
  {
    id: "white-feather-fall",
    sceneActionId: "follow_white_feather",
    locationId: "naming_stone_bank",
    timeOfDay: "night",
    label: "白羽落点",
    hint: "夜里追随白羽的落点，获得白羽回声。",
    x: 58,
    y: 48,
    width: 12,
    height: 12,
    requiredClicks: 2,
    tone: "feather",
  },
  {
    id: "four-river-echo-1",
    groupId: "four-river-echo",
    sceneActionId: "hear_four_river_echo",
    locationId: "naming_stone_bank",
    step: 1,
    label: "第一道水声",
    hint: "先点击上游的水声。",
    x: 42,
    y: 50,
    width: 10,
    height: 9,
    requiredClicks: 2,
    tone: "water",
  },
  {
    id: "four-river-echo-2",
    groupId: "four-river-echo",
    sceneActionId: "hear_four_river_echo",
    locationId: "naming_stone_bank",
    step: 2,
    label: "第二道水声",
    hint: "再点击向右分开的水声。",
    x: 52,
    y: 55,
    width: 10,
    height: 9,
    requiredClicks: 2,
    tone: "water",
  },
  {
    id: "four-river-echo-3",
    groupId: "four-river-echo",
    sceneActionId: "hear_four_river_echo",
    locationId: "naming_stone_bank",
    step: 3,
    label: "第三道水声",
    hint: "第三次点击近处变亮的水纹。",
    x: 46,
    y: 64,
    width: 10,
    height: 9,
    requiredClicks: 2,
    tone: "water",
  },
  {
    id: "four-river-echo-4",
    groupId: "four-river-echo",
    sceneActionId: "hear_four_river_echo",
    locationId: "naming_stone_bank",
    step: 4,
    label: "第四道水声",
    hint: "最后点击下游水声，让四河回声合在一起。",
    x: 57,
    y: 70,
    width: 10,
    height: 9,
    requiredClicks: 2,
    tone: "water",
  },
  {
    id: "between-two-trees",
    sceneActionId: "stand_between_trees",
    locationId: "central_meadow",
    label: "两树之间",
    hint: "停在两树之间，感受这里不同于别处的安静。",
    x: 50,
    y: 54,
    width: 17,
    height: 13,
    requiredClicks: 2,
    tone: "tree",
  },
  {
    id: "moonlight-hotspot",
    sceneActionId: "touch_moonlight",
    locationId: "central_meadow",
    label: "月亮",
    hint: "夜晚的月亮洒落银光，触摸它获得神秘道标。",
    x: 50,
    y: 25,
    width: 12,
    height: 12,
    requiredClicks: 2,
    tone: "tree",
  },
];

// ---- 地图旅行状态计算（选中地点相对当前位置） ----
type MapTravelStatus = {
  kind: "current" | "reachable" | "blocked";
  label: string;
};

/** 检查从 from 到 to 是否存在不经过 central_meadow 的路径 */
function hasPathAvoidingCentral(from: EdenLocationId, to: EdenLocationId): boolean {
  if (from === to) return true;
  if (from === "central_meadow" || to === "central_meadow") return false;
  const visited = new Set<EdenLocationId>([from]);
  const queue: EdenLocationId[] = [from];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const next of EDEN_LOCATIONS[curr].connections) {
      if (next === "central_meadow") continue;
      if (next === to) return true;
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}

function getMapTravelStatus(selectedId: EdenLocationId, currentId: EdenLocationId): MapTravelStatus {
  if (selectedId === currentId) return { kind: "current", label: "你在这里" };
  if (EDEN_LOCATIONS[currentId].connections.includes(selectedId)) {
    return { kind: "reachable", label: `可从${EDEN_LOCATIONS[currentId].name}前往` };
  }
  // 不可直达：判断是否只能经园子中央到达
  if (
    currentId !== "central_meadow" &&
    selectedId !== "central_meadow" &&
    !hasPathAvoidingCentral(currentId, selectedId)
  ) {
    return { kind: "blocked", label: `需要先前往${EDEN_LOCATIONS.central_meadow.name}` };
  }
  return { kind: "blocked", label: "需要沿相邻地点绕行" };
}

// ---- 深拷贝初始状态 ----
function makeInitialState(): EdenWorldState {
  return {
    ...initialEdenWorldState,
    actionPoints: initialEdenWorldState.actionPoints,
    maxActionPoints: initialEdenWorldState.maxActionPoints,
    npcActionPoints: initialEdenWorldState.npcActionPoints,
    maxNpcActionPoints: initialEdenWorldState.maxNpcActionPoints,
    eveMind: { ...initialEdenWorldState.eveMind },
    adamMind: { ...initialEdenWorldState.adamMind },
    hedgehog: { ...initialEdenWorldState.hedgehog },
    npcLocations: { ...initialEdenWorldState.npcLocations },
    discoveredClues: [...initialEdenWorldState.discoveredClues],
    inventory: [...initialEdenWorldState.inventory],
    npcDialogues: [...initialEdenWorldState.npcDialogues],
    corruptionTrace: [...initialEdenWorldState.corruptionTrace],
    worldActions: { ...initialEdenWorldState.worldActions },
    toolCallHistory: [...initialEdenWorldState.toolCallHistory],
    actionsThisSlot: {
      whisperedNpcIds: [...initialEdenWorldState.actionsThisSlot.whisperedNpcIds],
      sceneActionIds: [...initialEdenWorldState.actionsThisSlot.sceneActionIds],
      usedItemIds: [...initialEdenWorldState.actionsThisSlot.usedItemIds],
      hasWhisperedToWoman: initialEdenWorldState.actionsThisSlot.hasWhisperedToWoman,
    },
    unlockedAchievementIds: [...initialEdenWorldState.unlockedAchievementIds],
    usedItemIds: [...initialEdenWorldState.usedItemIds],
    sceneActionIds: [...initialEdenWorldState.sceneActionIds],
    itemCounts: { ...initialEdenWorldState.itemCounts },
    preparedResonanceId: initialEdenWorldState.preparedResonanceId,
    pendingConsumableEffects: [...initialEdenWorldState.pendingConsumableEffects],
    resonanceUseHistory: [...initialEdenWorldState.resonanceUseHistory],
    divineVisitCount: initialEdenWorldState.divineVisitCount,
    divineGiftHistory: [...initialEdenWorldState.divineGiftHistory],
    lastDivineGiftHint: initialEdenWorldState.lastDivineGiftHint,
    calmWhisperStreak: initialEdenWorldState.calmWhisperStreak,
    lastInputTag: initialEdenWorldState.lastInputTag,
  };
}

// ---- 组件 ----
export default function WorldPage() {
  const [state, setState] = useState<EdenWorldState>(makeInitialState);

  // ---- 引言 Beat ----
  const [introBeat, setIntroBeat] = useState(0);

  // ---- 对话状态 ----
  const [playerInput, setPlayerInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeNpc, setActiveNpc] = useState<EdenNpcId | null>(null);
  const [conversationHistories, setConversationHistories] = useState<Record<string, HistoryEntry[]>>({});
  /** 对话历史持久化备份（防止状态意外丢失） */
  const conversationHistoriesRef = useRef<Record<string, HistoryEntry[]>>({});
  const [currentReply, setCurrentReply] = useState<string | null>(null);
  const [systemHint, setSystemHint] = useState<string | null>(null);
  const [divineNarration, setDivineNarration] = useState<string | null>(null);
  const [hedgehogNarration, setHedgehogNarration] = useState<string | null>(null);
  const [toolNarration, setToolNarration] = useState<string | null>(null);
  const [slotNarrations, setSlotNarrations] = useState<string[] | null>(null);
  const [achievementToast, setAchievementToast] = useState<string | null>(null);
  const [selectedWhisperStyle, setSelectedWhisperStyle] = useState<WhisperStyle["id"] | null>(null);
  const [serpentTokenStats, setSerpentTokenStats] = useState<SerpentTokenStats>({
    lastTotal: 0,
    total: 0,
    lastWasEstimated: false,
  });

  // ---- 面板状态 ----
  const [activeTab, setActiveTab] = useState<PanelTab>("dialogue");
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [selectedMapLocationId, setSelectedMapLocationId] = useState<EdenLocationId>(state.locationId);
  const [isWorldPanelOpen, setWorldPanelOpen] = useState(true);
  const [isWorldPanelDragging, setWorldPanelDragging] = useState(false);
  const [worldPanelFrame, setWorldPanelFrame] = useState<WorldPanelFrame>({
    x: null,
    y: 86,
    width: 360,
    height: 620,
  });

  // ---- 场景明暗状态：browse=浏览（亮），dialogue=对话（暗） ----
  const [sceneFocusMode, setSceneFocusMode] = useState<"browse" | "dialogue">("browse");
  const [sceneFocusProgress, setSceneFocusProgress] = useState<Record<string, number>>({});

  // ---- 成就浮窗独立打开状态 ----
  const [achievementModalOpen, setAchievementModalOpen] = useState(false);

  // ---- 属性 Tab 选中的角色（独立于对话 NPC，默认 null 表示跟随对话 NPC） ----
  const [selectedMindNpc, setSelectedMindNpc] = useState<EdenNpcId | null>(null);

  // ---- 回响面板状态 ----
  const [resonancePanelOpen, setResonancePanelOpen] = useState(false);
  const [divineGiftToast, setDivineGiftToast] = useState<DivineGiftFrontend | null>(null);
  const [resonanceGainedToast, setResonanceGainedToast] = useState<{ itemId: string; title: string; narration: string } | null>(null);

  // ---- 行动点耗尽提示状态 ----
  const [apDepletedToast, setApDepletedToast] = useState<{ visible: boolean; hiding: boolean }>({ visible: false, hiding: false });

  // ---- refs ----
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogueEndRef = useRef<HTMLDivElement>(null);
  const worldPanelRef = useRef<HTMLElement>(null);
  const worldPanelDragRef = useRef<WorldPanelDragState | null>(null);
  /** 记录已预留AP的场景互动ID（首次点击时消耗AP，后续不重复消耗） */
  const sceneApReservedRef = useRef<Set<string>>(new Set());
  /** 刺猬连续点击计数与重置定时器 */
  const hedgehogClickCountRef = useRef<number>(0);
  const hedgehogClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- 音频：Chapter 0 hook 负责声音开关与结局音，Chapter 1 hook 负责世界探索音景 ----
  const { soundEnabled, toggleSound, playWhisperSubmit } = useChapter0Audio({
    temptationProgress: state.divineAttention,
    endingId: state.endingId,
    phase: state.phase === "intro" ? "intro" : "ending",
  });
  const {
    playMapMove,
    playObserveLocation,
    playNpcDialogue,
    playHedgehogRustle,
    playDivineAttentionRise,
    playTreeLook,
    playApproachTree,
    playTouchFruit,
  } = useChapter1Audio({
    phase: state.phase,
    locationId: state.locationId,
    divineAttention: state.divineAttention,
    soundEnabled,
  });

  // ---- 显示行动点耗尽提示 ----
  const showApDepletedToast = useCallback(() => {
    setApDepletedToast({ visible: true, hiding: false });
    // 4.5秒后开始隐藏动画，然后完全移除
    setTimeout(() => {
      setApDepletedToast({ visible: true, hiding: true });
      setTimeout(() => {
        setApDepletedToast({ visible: false, hiding: false });
      }, 400);
    }, 4500);
  }, []);

  // ---- 自动调整 textarea 高度 ----
  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [playerInput, adjustTextareaHeight]);

  // ---- 滚动对话到底部 ----
  useEffect(() => {
    dialogueEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationHistories, currentReply, systemHint]);

  useEffect(() => {
    if (!isWorldPanelOpen || !worldPanelRef.current) return;
    const observedPanel = worldPanelRef.current;
    const resizeObserver = new ResizeObserver(() => {
      const { width, height } = observedPanel.getBoundingClientRect();
      setWorldPanelFrame((prev) => {
        if (Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1) return prev;
        return { ...prev, width, height };
      });
    });
    resizeObserver.observe(observedPanel);
    return () => resizeObserver.disconnect();
  }, [isWorldPanelOpen]);

  // 移除进度自动重置，进入下一轮后保留点击进度
  // useEffect(() => {
  //   setSceneFocusProgress({});
  // }, [state.locationId, state.timeSlot, state.timeOfDay]);

  // ---- 引言阶段：Enter / Space 辅助推进 ----
  const handleIntroAdvance = useCallback(() => {
    if (introBeat < CHAPTER1_INTRO_BEATS.length - 1) {
      setIntroBeat((b) => b + 1);
    } else {
      setState((prev) => ({ ...prev, phase: "explore" }));
    }
  }, [introBeat]);

  useEffect(() => {
    if (state.phase !== "intro") return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleIntroAdvance();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [state.phase, handleIntroAdvance]);

// ---- 获取当前地点的 NPC 列表（动态位置 + 默认位置 + 昼夜过滤） ----
const getCurrentLocationNpcs = useCallback((s: EdenWorldState): EdenNpcId[] => {
  const npcs = new Set<EdenNpcId>();
  const loc = EDEN_LOCATIONS[s.locationId];

  // 根据昼夜选择对应的 NPC 列表（昼夜过滤的关键）
  const availableNpcs = s.timeOfDay === "day" ? loc.dayNpcs : loc.nightNpcs;

  // 只添加当前时段允许出现且确实在当前地点的 NPC
  availableNpcs.forEach((npcId) => {
    if (s.npcLocations[npcId] === s.locationId) {
      npcs.add(npcId);
    }
  });

  // forbidden_tree 和 tree_of_life 不作为可对话 NPC，但保留在列表中供场景渲染使用
  // npcs.delete("forbidden_tree");
  // npcs.delete("tree_of_life");

  return Array.from(npcs);
}, []);

  // ---- 选择低语对象 ----
  const handleSelectNpc = useCallback((npc: EdenNpcId) => {
    setActiveNpc(npc);
    setWorldPanelOpen(true);
    setSceneFocusMode("dialogue");
    setCurrentReply(null);
    setSystemHint(null);
    setToolNarration(null);
    setHedgehogNarration(null);
    setActiveTab("dialogue");
  }, []);

  const handleWorldPanelDragStart = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const rect = worldPanelRef.current?.getBoundingClientRect();
    if (!rect) return;

    worldPanelDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: rect.left,
      startTop: rect.top,
      width: rect.width,
      height: rect.height,
    };
    setWorldPanelFrame((prev) => ({
      ...prev,
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    }));
    setWorldPanelDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handleWorldPanelDragMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = worldPanelDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const maxX = Math.max(12, window.innerWidth - drag.width - 12);
    const maxY = Math.max(76, window.innerHeight - drag.height - 12);
    const nextX = clampNumber(drag.startLeft + event.clientX - drag.startX, 12, maxX);
    const nextY = clampNumber(drag.startTop + event.clientY - drag.startY, 76, maxY);

    setWorldPanelFrame({
      x: nextX,
      y: nextY,
      width: drag.width,
      height: drag.height,
    });
  }, []);

  const handleWorldPanelDragEnd = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = worldPanelDragRef.current;
    if (drag?.pointerId === event.pointerId) {
      worldPanelDragRef.current = null;
      setWorldPanelDragging(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  }, []);

  // ---- 退出对话状态：点击场景空白区域，回到浏览状态 ----
  const handleExitDialogueFocus = useCallback(() => {
    setActiveNpc(null);
    setSceneFocusMode("browse");
    setCurrentReply(null);
    setSystemHint(null);
    setToolNarration(null);
    setHedgehogNarration(null);
  }, []);

  // ---- 提交低语 ----
  const handleSubmit = useCallback(async () => {
    if (state.phase !== "explore" || isLoading) return;
    if (!activeNpc) {
      setSystemHint("请先选择一个低语对象。");
      return;
    }
    if (!playerInput.trim()) {
      setSystemHint("请输入你的低语⋯⋯蛇不能沉默。");
      return;
    }
    if (state.actionPoints <= 0) {
      showApDepletedToast();
      return;
    }

    const currentInput = playerInput;
    const targetNpc = activeNpc;
    const history = conversationHistories[targetNpc] ?? [];

    setIsLoading(true);
    setSystemHint(null);

    try {
      const response = await fetch("/api/world", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerInput: currentInput,
          state,
          targetNpc,
          conversationHistory: history.map((e) => ({
            role: e.role === "serpent" ? "serpent" : targetNpc,
            text: e.text,
          })),
        }),
      });

      const data: WorldAgentResponse = await response.json();

      if (data.ok && data.state) {
        const newToolCalls = data.state.toolCallHistory.slice(state.toolCallHistory.length);
        if (data.state.divineAttention > state.divineAttention) {
          playDivineAttentionRise();
        }
        for (const toolName of newToolCalls) {
          if (toolName === "look_at_tree") playTreeLook();
          if (toolName === "approach_tree") playApproachTree();
          if (toolName === "touch_fruit") playTouchFruit();
        }
        if (targetNpc === "hedgehog") {
          playHedgehogRustle();
        } else {
          playNpcDialogue();
        }

        setState(data.state);
        setCurrentReply(data.reply);
        setSystemHint(data.systemHint);
        setDivineNarration(data.divineAttentionNarration ?? null);
        setHedgehogNarration(data.hedgehogNarration ?? null);
        setToolNarration(data.toolNarration ?? null);
        setSlotNarrations(data.slotNarrations ?? null);
        // 第一章：处理回响叙事
        if (data.resonanceNarration) {
          setToolNarration(data.resonanceNarration);
        }
        // 第一章：处理神明献礼
        if (data.divineGift) {
          setDivineGiftToast(data.divineGift);
          // 5秒后自动关闭
          setTimeout(() => setDivineGiftToast(null), 5000);
        }
        // 第一章：处理获得回响
        if (data.resonanceGained) {
          setResonanceGainedToast(data.resonanceGained);
          // 5秒后自动关闭
          setTimeout(() => setResonanceGainedToast(null), 5000);
        }
        if (data.unlockedAchievements && data.unlockedAchievements.length > 0) {
          const last = data.unlockedAchievements[data.unlockedAchievements.length - 1];
          const ach = getAchievementById(last);
          setAchievementToast(ach ? `解锁印记：${ach.name}` : null);
        }
        const turnTokenUsage = data.usage?.total_tokens ?? estimateWorldTokenUsage([
          currentInput,
          data.reply,
          data.systemHint,
          data.divineAttentionNarration,
          data.hedgehogNarration,
          data.toolNarration,
          data.resonanceNarration,
          ...(data.slotNarrations ?? []),
        ]);
        setSerpentTokenStats((prev) => ({
          lastTotal: turnTokenUsage,
          total: prev.total + turnTokenUsage,
          lastWasEstimated: !data.usage,
        }));

        const newEntries: HistoryEntry[] = [{ role: "serpent", text: currentInput }];
        if (data.reply) newEntries.push({ role: "npc", text: data.reply });
        setConversationHistories((prev) => {
          const merged = {
            ...prev,
            [targetNpc]: [...(prev[targetNpc] ?? []), ...newEntries],
          };
          conversationHistoriesRef.current = merged;
          return merged;
        });

        playWhisperSubmit();
      } else {
        setSystemHint(data.systemHint ?? "园中起了风，声音暂时听不清。");
      }
    } catch {
      setSystemHint("连接中断，园中的风带走了声音。");
    } finally {
      setIsLoading(false);
      setPlayerInput("");
      setSelectedWhisperStyle(null);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [
    state,
    playerInput,
    activeNpc,
    isLoading,
    conversationHistories,
    playWhisperSubmit,
    playDivineAttentionRise,
    playTreeLook,
    playApproachTree,
    playTouchFruit,
    playHedgehogRustle,
    playNpcDialogue,
    showApDepletedToast,
  ]);

  // ---- 键盘提交 ----
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  // ---- 通用工具调用（移动 / 观察 / 场景互动 / 结束时段 / 回响操作） ----
  const handleToolCall = useCallback(
    async (
      tool: "move_to_location" | "observe_location" | "scene_action" | "end_slot" | "prepare_resonance" | "cancel_prepared_resonance" | "use_resonance",
      args: { locationId?: EdenLocationId; sceneActionId?: string; itemId?: string; clickIndex?: number; requiredClicks?: number },
    ) => {
      if (state.phase !== "explore" || isLoading) return;

      // 检查AP是否足够（end_slot、回响操作不消耗行动点）
      if (tool !== "end_slot" && tool !== "prepare_resonance" && tool !== "cancel_prepared_resonance" && tool !== "use_resonance") {
        if (state.actionPoints <= 0) {
          showApDepletedToast();
          return;
        }
      }

      setIsLoading(true);
      setSystemHint(null);
      if (tool === "move_to_location") setMapModalOpen(false);

      try {
        const response = await fetch("/api/world/tool", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tool, state, args }),
        });

        const data: WorldToolResponse = await response.json();

        if (data.ok && data.state) {
          if (tool === "move_to_location") {
            playMapMove();
          } else if (tool === "observe_location") {
            playObserveLocation();
          } else if (tool === "scene_action") {
            playObserveLocation();
            const actionId = args.sceneActionId ?? "";
            if (actionId.includes("hedgehog") || actionId.includes("deer")) {
              playHedgehogRustle();
            }
          }
          if (data.state.divineAttention > state.divineAttention) {
            playDivineAttentionRise();
          }

          setState(data.state);
          setToolNarration(data.narration);
          setSlotNarrations(data.slotNarrations ?? null);
          // 第一章：处理回响叙事
          if (data.resonanceNarration) {
            setToolNarration(data.resonanceNarration);
          }
          // 第一章：处理神明献礼
          if (data.divineGift) {
            setDivineGiftToast(data.divineGift);
            setTimeout(() => setDivineGiftToast(null), 5000);
          }
          if (data.unlockedAchievements && data.unlockedAchievements.length > 0) {
            const last = data.unlockedAchievements[data.unlockedAchievements.length - 1];
            const ach = getAchievementById(last);
            setAchievementToast(ach ? `解锁印记：${ach.name}` : null);
          }
          setCurrentReply(null);
          setHedgehogNarration(null);
          if (tool === "move_to_location") {
            setActiveNpc(null);
            setSceneFocusMode("browse");
            setSelectedMapLocationId(data.state.locationId);
          }
        } else {
          setSystemHint(data.reason ?? data.narration ?? "无法执行此操作。");
        }
      } catch {
        setSystemHint("连接中断，园中的风带走了声音。");
      } finally {
        setIsLoading(false);
      }
    },
    [
      state,
      isLoading,
      playMapMove,
      playObserveLocation,
      playHedgehogRustle,
      playDivineAttentionRise,
    ],
  );

  const handleSceneHotspotClick = useCallback((hotspot: SceneFocusHotspot) => {
    if (state.phase !== "explore" || state.isEnded || isLoading) return;
    if (state.actionPoints <= 0) {
      showApDepletedToast();
      return;
    }

    const progressKey = hotspot.groupId ?? hotspot.id;
    const currentProgress = sceneFocusProgress[progressKey] ?? 0;
    const expectedStep = currentProgress + 1;

    setActiveNpc(null);
    setCurrentReply(null);
    setSceneFocusMode("browse");

    if (hotspot.step && hotspot.step !== expectedStep) {
      const nextHotspot = SCENE_FOCUS_HOTSPOTS.find(
        (candidate) => candidate.groupId === hotspot.groupId && candidate.step === expectedStep,
      );
      setSystemHint(nextHotspot ? `先点击「${nextHotspot.label}」。` : "请按场景中亮起的顺序点击。");
      return;
    }

    const nextProgress = hotspot.step ? hotspot.step : currentProgress + 1;
    const reachesAction = nextProgress >= hotspot.requiredClicks;

    // 每次点击立即调用 API 消耗 1 AP
    if (reachesAction) {
      setSceneFocusProgress((prev) => ({ ...prev, [progressKey]: 0 }));
      setSystemHint(`${hotspot.label}已经完全亮起。`);
    } else {
      setSceneFocusProgress((prev) => ({ ...prev, [progressKey]: nextProgress }));
    }
    handleToolCall("scene_action", {
      sceneActionId: hotspot.sceneActionId,
      clickIndex: nextProgress,
      requiredClicks: hotspot.requiredClicks,
    });
  }, [
    state.phase,
    state.isEnded,
    state.actionPoints,
    isLoading,
    sceneFocusProgress,
    handleToolCall,
    showApDepletedToast,
  ]);

  // ---- 新增工具调用（carry_words / judge_whisper_style）----
  const handleNewToolCall = useCallback(
    async (tool: "carry_words" | "judge_whisper_style", actorId: string) => {
      if (state.phase !== "explore" || isLoading) return;

      setIsLoading(true);
      setSystemHint(null);

      try {
        const response = await fetch("/api/world/tool", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tool, state, args: { actorId } }),
        });

        const data: WorldToolResponse = await response.json();

        if (data.ok && data.state) {
          if (tool === "carry_words") {
            playNpcDialogue();
          } else if (tool === "judge_whisper_style") {
            playNpcDialogue();
          }
          if (data.state.divineAttention > state.divineAttention) {
            playDivineAttentionRise();
          }

          setState(data.state);
          setToolNarration(data.narration);
          setSlotNarrations(data.slotNarrations ?? null);
          if (data.unlockedAchievements && data.unlockedAchievements.length > 0) {
            const last = data.unlockedAchievements[data.unlockedAchievements.length - 1];
            const ach = getAchievementById(last);
            setAchievementToast(ach ? `解锁印记：${ach.name}` : null);
          }
          setCurrentReply(null);
          setHedgehogNarration(null);
        } else {
          setSystemHint(data.reason ?? data.narration ?? "无法执行此操作。");
        }
      } catch {
        setSystemHint("连接中断，园中的风带走了声音。");
      } finally {
        setIsLoading(false);
      }
    },
    [state, isLoading, playNpcDialogue, playDivineAttentionRise, showApDepletedToast],
  );

  // ---- 地图热点点击处理：只选中地点，不直接移动 ----
    const handleMapLocationClick = useCallback((locId: EdenLocationId) => {
      setSelectedMapLocationId(locId);
      setSystemHint(null);
    }, []);

  // ---- 地图确认进入：可达地点才调用 move_to_location ----
    const handleMapConfirmEnter = useCallback(() => {
      const status = getMapTravelStatus(selectedMapLocationId, state.locationId);
      if (status.kind !== "reachable") return;
      handleToolCall("move_to_location", { locationId: selectedMapLocationId });
    }, [selectedMapLocationId, state.locationId, handleToolCall]);

  // ---- 重新开始 ----
    const handleRestart = useCallback(() => {
    const fresh = makeInitialState();
    setState(fresh);
    setSelectedMapLocationId(fresh.locationId);
    setIntroBeat(0);
    setPlayerInput("");
    setActiveNpc(null);
    setConversationHistories({});
    conversationHistoriesRef.current = {};
    setCurrentReply(null);
    setSystemHint(null);
    setDivineNarration(null);
    setHedgehogNarration(null);
    setToolNarration(null);
    setSlotNarrations(null);
    setAchievementToast(null);
    setSelectedWhisperStyle(null);
    setSceneFocusProgress({});
    setSerpentTokenStats({
      lastTotal: 0,
      total: 0,
      lastWasEstimated: false,
    });
    setActiveTab("dialogue");
    setSceneFocusMode("browse");
  }, []);

// ---- 时段显示辅助 ----
function getTimeSlotDisplay(timeSlot: number, dayIndex: number, timeOfDay: TimeOfDay): string {
  const dayNames = ["", "周一", "周二", "周三", "周四", "周五", "周六"];
  const timeLabel = timeOfDay === "day" ? "白天" : "夜晚";
  return `时段 ${timeSlot}/12 · ${dayNames[dayIndex]} ${timeLabel}`;
}

// ---- 派生数据 ----
const currentLocation = EDEN_LOCATIONS[state.locationId];
const currentNpcs = getCurrentLocationNpcs(state);
const currentHistory = activeNpc
  ? (conversationHistories[activeNpc]?.length
      ? conversationHistories[activeNpc]
      : conversationHistoriesRef.current[activeNpc] ?? [])
  : [];
const activeNpcMeta = activeNpc ? EDEN_NPCS[activeNpc] : null;
const isExploreActive = state.phase === "explore" && !state.isEnded;
const divineNarrationText = divineNarration ?? DIVINE_ATTENTION_NARRATIONS[state.divineAttention];
const currentLocationBg = getLocationBg(state.locationId, state.timeOfDay, state.timeSlot);
const availableSceneActions: SceneAction[] = isExploreActive
  ? getSceneActionsByLocation(state.locationId, state.timeOfDay, state.timeSlot, state.divineAttention)
      .filter((a) => !state.actionsThisSlot.sceneActionIds.includes(a.id))
  : [];
const availableSceneActionIds = new Set(availableSceneActions.map((action) => action.id));
const visibleSceneHotspots = SCENE_FOCUS_HOTSPOTS.filter((hotspot) => {
  if (hotspot.locationId !== state.locationId) return false;
  if (hotspot.timeOfDay && hotspot.timeOfDay !== state.timeOfDay) return false;
  return availableSceneActionIds.has(hotspot.sceneActionId);
});
const hasWhisperedToActiveNpc = activeNpc
  ? state.actionsThisSlot.whisperedNpcIds.filter((id) => id === activeNpc).length >= 3
  : false;
const whisperCountForActiveNpc = activeNpc
  ? state.actionsThisSlot.whisperedNpcIds.filter((id) => id === activeNpc).length
  : 0;
  // 属性 Tab 展示的角色：优先用 selectedMindNpc，否则跟随对话 NPC
  const mindTabNpc = selectedMindNpc ?? activeNpc;
  const activeAttributeProfile = buildAttributeProfile(mindTabNpc, state);
  const recommendedWhispers = getRecommendedWhispers(activeNpc);

  // ---- 自我意识路径：玩家看到的完成机制 ----
  const forbiddenChainProgress = [
    { label: "注意到禁令之外的问题", done: state.worldActions.lookedAtTree },
    { label: "靠近自己的疑问", done: state.worldActions.approachedTree },
    { label: "停在不可逆选择前", done: state.worldActions.touchedFruit },
    { label: "说出自己的想知道", done: state.worldActions.hasEatenFruit },
  ];

  const worldPanelStyle: CSSProperties = {
    top: worldPanelFrame.y,
    width: worldPanelFrame.width,
    height: worldPanelFrame.height,
    ...(worldPanelFrame.x === null
      ? { right: "clamp(16px, 3vw, 32px)" }
      : { left: worldPanelFrame.x }),
  };

  // ====================== 渲染：Intro 阶段 ======================
  if (state.phase === "intro") {
    const beat = CHAPTER1_INTRO_BEATS[introBeat];
    const isLastBeat = introBeat >= CHAPTER1_INTRO_BEATS.length - 1;
    const introBgSrc = introBeat === 0
      ? CHAPTER0_IMAGES.secondEdenPrologueBackground
      : introBeat === 1
        ? CHAPTER0_IMAGES.genesisCreationLight
        : introBeat === 4
          ? CHAPTER1_IMAGES.centralMeadow
          : CHAPTER0_IMAGES.secondEdenBackground;

    return (
      <div className="eden-game eden-game--intro" onClick={handleIntroAdvance}>
        <div className="eden-bg">
          <Image
            src={introBgSrc}
            alt="伊甸园"
            fill
            priority
            sizes="100vw"
            style={{ objectFit: "cover" }}
          />
          <div className="eden-bg-overlay eden-bg-overlay--intro" />
        </div>

        <header className="eden-header" onClick={(e) => e.stopPropagation()}>
          <div className="eden-header-left">
            <h1 className="eden-title">EDEN</h1>
            <span className="eden-chapter-tag">第一章 · 园中诸声</span>
          </div>
          <button
            className="eden-sound-btn"
            onClick={toggleSound}
            aria-label={soundEnabled ? "关闭声音" : "开启声音"}
          >
            {soundEnabled ? "🔊" : "🔇"}
          </button>
        </header>

        <main className="eden-intro-beat-main">
          <div className="eden-intro-beat-content">
            <div className="eden-intro-beat-text" key={`beat-${introBeat}`}>
              {beat.split("\n").map((line, i) => (
                <p key={i} className={`eden-beat-line ${line === "" ? "eden-beat-line--blank" : ""}`}>
                  {line}
                </p>
              ))}
            </div>
          </div>
        </main>

        <footer className="eden-intro-beat-footer" onClick={(e) => e.stopPropagation()}>
          <button
            className="eden-btn eden-btn--primary eden-btn--beat-advance"
            onClick={handleIntroAdvance}
          >
            {introBeat === 0 ? "进入观测" : isLastBeat ? "进入伊甸园" : "继续"}
          </button>
        </footer>
      </div>
    );
  }

  // ====================== 渲染：Ending 阶段 ======================
  if (state.phase === "ending" || state.isEnded) {
    const isSuccess = state.endingId === "eve_eats_fruit";
    return (
      <div className={`eden-game eden-game--ending eden-game--${isSuccess ? "success" : "failure"}`}>
        <div className="eden-bg">
          <Image
            src={isSuccess ? CHAPTER0_IMAGES.endingEveEatsFruit : CHAPTER0_IMAGES.endingGodArrives}
            alt="结局"
            fill
            sizes="100vw"
            style={{ objectFit: "cover" }}
          />
          <div className={`eden-bg-overlay eden-bg-overlay--${isSuccess ? "success" : "failure"}`} />
        </div>

        <header className="eden-header">
          <div className="eden-header-left">
            <h1 className="eden-title">EDEN</h1>
            <span className="eden-chapter-tag">第一章 · 园中诸声 · 结局</span>
          </div>
          <button
            className="eden-sound-btn"
            onClick={toggleSound}
            aria-label={soundEnabled ? "关闭声音" : "开启声音"}
          >
            {soundEnabled ? "🔊" : "🔇"}
          </button>
        </header>

        <main className="eden-ending-content">
          <div className="eden-scroll eden-ending-scroll">
            <EndingReview state={state} />
            <button className="eden-btn eden-btn--primary eden-btn--restart" onClick={handleRestart}>
              重新开始
            </button>
            <Link
              href="/"
              className="eden-btn eden-btn--primary"
              style={{ textDecoration: "none", marginTop: 8, padding: "14px 40px", fontSize: "1.05rem", display: "inline-block" }}
            >
              返回首页
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // ====================== 渲染：Explore 阶段 ======================
  // 采用与 Chapter 0 教程统一的布局：左侧立绘场景 + 右侧浮窗面板 + 底部输入

  return (
    <div className={`eden-game eden-game--dialogue eden-game--world eden-game--world-${sceneFocusMode} scene-progress-${state.divineAttention}`}>
      {/* 背景层：当前地点场景图 */}
      <div className="eden-bg">
        <Image
          src={currentLocationBg}
          alt={currentLocation.name}
          fill
          sizes="100vw"
          style={{ objectFit: "cover" }}
        />
        <div className={`eden-bg-overlay ${sceneFocusMode === "dialogue" ? "eden-bg-overlay--dialogue" : "eden-bg-overlay--browse"}`} />
      </div>

      {/* 顶部栏 */}
      <header className="eden-header">
        <div className="eden-header-left">
          <h1 className="eden-title">EDEN</h1>
          <span className="eden-chapter-tag">第一章 · 园中诸声</span>
          {/* 第一章：神的注视阶段 - 移到左边 */}
          {(() => {
            const stage = getDivineAttentionStage(state.divineVisitCount);
            return (
              <span
                className={`eden-attention-stage eden-attention-stage--${stage.tone}`}
                title={`神的注视阶段：${stage.title}（满 4 后将触发神明献礼）`}
              >
                {stage.title}
                <span className="eden-attention-dots-small">
                  {"●".repeat(state.divineAttention)}{"○".repeat(4 - state.divineAttention)}
                </span>
              </span>
            );
          })()}
        </div>
        <div className="eden-header-center">
          <span className="eden-time-slot-badge">
            {getTimeSlotDisplay(state.timeSlot, state.dayIndex, state.timeOfDay)}
          </span>
          <span className="eden-ap-dots" title={`行动点 ${state.actionPoints}/${state.maxActionPoints}`}>
            {Array.from({ length: state.maxActionPoints }, (_, i) => (
              <span key={i} className={i < state.actionPoints ? "eden-ap-dot eden-ap-dot--filled" : "eden-ap-dot eden-ap-dot--empty"}>
                {i < state.actionPoints ? "●" : "○"}
              </span>
            ))}
          </span>
          <button
            className="eden-btn eden-btn--next-slot"
            onClick={() => {
              if (state.isEnded) return;
              if (window.confirm("结束这一轮，进入下一时段？")) {
                handleToolCall("end_slot", {});
              }
            }}
            disabled={isLoading || state.isEnded}
            title="结束本轮，推进到下一时段并恢复行动点"
          >
            进入下一轮
          </button>
        </div>
        <div className="eden-header-right">
          {/* 园中回响按钮 */}
          <button
            className="eden-btn eden-top-action-btn eden-btn--resonance"
            onClick={() => setResonancePanelOpen((open) => !open)}
            aria-pressed={resonancePanelOpen}
            aria-label={resonancePanelOpen ? "收起回响面板" : "打开园中回响面板"}
            title="园中回响"
          >
            <span className="eden-top-action-icon">⬡</span>
            <span className="eden-top-action-label">回响 {state.inventory.length}</span>
          </button>
          <button
            className="eden-btn eden-top-action-btn eden-btn--suggestion"
            onClick={() => {
              setSelectedMapLocationId(state.locationId);
              setMapModalOpen(true);
            }}
            aria-label="打开伊甸园地图"
          >
            <span className="eden-top-action-icon">✦</span>
            <span className="eden-top-action-label">地图</span>
          </button>
          <button
            className="eden-btn eden-top-action-btn eden-btn--achievement-icon"
            onClick={() => setAchievementModalOpen(true)}
            aria-label="查看园中印记"
            title={`园中印记（${state.unlockedAchievementIds.length}/${ACHIEVEMENTS.length}）`}
          >
            <span className="eden-top-action-icon">✧</span>
            <span className="eden-top-action-label">印记 {state.unlockedAchievementIds.length}</span>
          </button>
          <button
            className="eden-btn eden-top-action-btn eden-btn--suggestion"
            onClick={() => setWorldPanelOpen((open) => !open)}
            aria-pressed={isWorldPanelOpen}
            aria-label={isWorldPanelOpen ? "收起对话框" : "打开对话框"}
          >
            <span className="eden-top-action-icon">{isWorldPanelOpen ? "◱" : "◰"}</span>
            <span className="eden-top-action-label">{isWorldPanelOpen ? "收起" : "对话"}</span>
          </button>
          <button
            className="eden-sound-btn"
            onClick={toggleSound}
            aria-label={soundEnabled ? "关闭声音" : "开启声音"}
          >
            {soundEnabled ? "🔊" : "🔇"}
          </button>
        </div>
      </header>

      {/* 左侧/中央：伊甸园场景（与教程统一的立绘布局） */}
      <main className="eden-dialogue-layout">
        <section
          className="eden-stage"
          onClick={() => {
            if (sceneFocusMode === "dialogue") handleExitDialogueFocus();
          }}
        >
          {/* 地点标题浮层 */}
          <div className="eden-world-stage-caption" style={{ position: "absolute", left: 24, top: 24, zIndex: 4 }}>
            <span className="eden-world-stage-kicker">当前位置</span>
            <strong style={{ color: "#ead9ad", fontSize: "1.12rem", fontWeight: 500 }}>{currentLocation.name}</strong>
            <span style={{ display: "block", fontSize: "0.78rem", color: "#b7b08e", marginTop: 2 }}>{currentLocation.shortDesc}</span>
          </div>

          {visibleSceneHotspots.length > 0 && (
            <div className="eden-scene-hotspot-layer" aria-label="场景可点击物件">
              {visibleSceneHotspots.map((hotspot) => {
                const progressKey = hotspot.groupId ?? hotspot.id;
                const currentProgress = sceneFocusProgress[progressKey] ?? 0;
                const isCompletedStep = hotspot.step ? currentProgress >= hotspot.step : false;
                const isNextStep = hotspot.step ? currentProgress + 1 === hotspot.step : true;
                const progressRatio = hotspot.step
                  ? isCompletedStep
                    ? 1
                    : isNextStep
                      ? Math.max(0.28, currentProgress / hotspot.requiredClicks)
                      : 0.08
                  : Math.min(1, currentProgress / hotspot.requiredClicks);
                const stepState = hotspot.step
                  ? isCompletedStep
                    ? "completed"
                    : isNextStep
                      ? "next"
                      : "locked"
                  : "single";
                const progressLabel = hotspot.step
                  ? isNextStep || isCompletedStep
                    ? `${Math.min(currentProgress, hotspot.requiredClicks)}/${hotspot.requiredClicks}`
                    : ""
                  : currentProgress > 0
                    ? `${currentProgress}/${hotspot.requiredClicks}`
                    : "";

                return (
                  <button
                    key={hotspot.id}
                    type="button"
                    className={`eden-scene-hotspot eden-scene-hotspot--${hotspot.tone}`}
                    data-step-state={stepState}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSceneHotspotClick(hotspot);
                    }}
                    disabled={isLoading || !isExploreActive}
                    aria-label={`${hotspot.label}。${hotspot.hint}`}
                    title={hotspot.hint}
                    style={{
                      left: `${hotspot.x}%`,
                      top: `${hotspot.y}%`,
                      width: `${hotspot.width}%`,
                      height: `${hotspot.height}%`,
                      "--eden-hotspot-progress": progressRatio,
                    } as CSSProperties}
                  >
                    <span className="eden-scene-hotspot__glow" />
                    <span className="eden-scene-hotspot__label">
                      {hotspot.label}
                      {progressLabel && <small>{progressLabel}</small>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 当前地点的 NPC 立绘（与教程一致：女人右侧、亚当左侧、刺猬下方） */}
          {currentNpcs.includes("adam") && (
            <button
              className={`eden-stage-character eden-stage-character--adam ${activeNpc !== "adam" ? "eden-stage-character--dim" : ""}`}
              onClick={(e) => { e.stopPropagation(); if (activeNpc !== "adam") handleSelectNpc("adam"); }}
              aria-label="与亚当低语"
              tabIndex={activeNpc === "adam" ? -1 : 0}
            >
              <Image
                src={CHAPTER0_IMAGES.adamFullbodySprite}
                alt="亚当"
                width={320}
                height={640}
                className="eden-adam-stage-sprite"
                priority
              />
            </button>
          )}

          {currentNpcs.includes("eve") && (
            <button
              className={`eden-stage-character eden-stage-character--eve ${activeNpc !== "eve" ? "eden-stage-character--dim" : ""}`}
              onClick={(e) => { e.stopPropagation(); if (activeNpc !== "eve") handleSelectNpc("eve"); }}
              aria-label="与女人低语"
              tabIndex={activeNpc === "eve" ? -1 : 0}
            >
              <Image
                src={CHAPTER0_IMAGES.eveFullbodySprite}
                alt="女人"
                width={380}
                height={760}
                className="eden-eve-stage-sprite"
                priority
              />
            </button>
          )}

          {/* 刺猬（氛围动物，可点击低语 / 连续点击3次触发互动）—— 第一章使用圆润版透明立绘 */}
          {currentNpcs.includes("hedgehog") && (
            <button
              className={`eden-stage-animal ${activeNpc !== "hedgehog" ? "eden-stage-character--dim" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                // 连续点击3次触发刺猬互动
                if (hedgehogClickTimerRef.current) clearTimeout(hedgehogClickTimerRef.current);
                hedgehogClickCountRef.current += 1;
                const count = hedgehogClickCountRef.current;
                // 2秒内无新点击则重置计数
                hedgehogClickTimerRef.current = setTimeout(() => {
                  hedgehogClickCountRef.current = 0;
                }, 2000);
                if (count >= 3) {
                  hedgehogClickCountRef.current = 0;
                  if (hedgehogClickTimerRef.current) {
                    clearTimeout(hedgehogClickTimerRef.current);
                    hedgehogClickTimerRef.current = null;
                  }
                  handleToolCall("scene_action", { sceneActionId: "interact_with_hedgehog" });
                  return;
                }
                if (count === 1 && activeNpc !== "hedgehog") {
                  handleSelectNpc("hedgehog");
                }
                setSystemHint(`刺猬动了动刺（${count}/3）……`);
              }}
              aria-label="与刺猬低语（连续点击3次可互动）"
              tabIndex={activeNpc === "hedgehog" ? -1 : 0}
              style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", pointerEvents: "auto" }}
            >
              <Image
                src={CHAPTER1_IMAGES.hedgehogRoundedSprite}
                alt="刺猬"
                width={1254}
                height={1254}
                className="eden-world-hedgehog-sprite"
              />
            </button>
          )}

          {/* 守望天使（东园幽径远影，透明立绘 + 神的注视联动） */}
          {currentNpcs.includes("watching_angel") && (
            <button
              className={`eden-stage-angel eden-stage-angel--attention-${state.divineAttention} ${activeNpc === "watching_angel" ? "eden-stage-angel--active" : ""}`}
              onClick={(e) => { e.stopPropagation(); if (activeNpc !== "watching_angel") handleSelectNpc("watching_angel"); }}
              aria-label="与守望天使低语"
              tabIndex={activeNpc === "watching_angel" ? -1 : 0}
            >
              <Image
                src={CHAPTER1_IMAGES.watchingAngelSprite}
                alt="守望天使"
                width={1254}
                height={1254}
                className="eden-angel-stage-sprite"
              />
            </button>
          )}

          {/* 新增 NPC 渲染 - 基路伯 */}
          {currentNpcs.includes("cherubim") && (
            <button
              className={`eden-stage-angel eden-stage-angel--cherubim ${activeNpc === "cherubim" ? "eden-stage-angel--active" : ""}`}
              onClick={(e) => { e.stopPropagation(); if (activeNpc !== "cherubim") handleSelectNpc("cherubim"); }}
              aria-label="与基路伯低语"
              tabIndex={activeNpc === "cherubim" ? -1 : 0}
            >
              <Image
                src={CHAPTER1_IMAGES.cherubimSprite}
                alt="基路伯"
                width={1023}
                height={1537}
                className="eden-angel-stage-sprite"
              />
            </button>
          )}

          {/* 新增 NPC 渲染 - 小鹿（仅白天可见） */}
          {currentNpcs.includes("deer") && state.timeOfDay === "day" && (
            <div className="eden-stage-animal eden-stage-deer" />
          )}

          {/* 新增 NPC 渲染 - 狐狸（可评估话术） */}
          {currentNpcs.includes("fox") && (
            <div className="eden-stage-animal eden-stage-fox">
              <button
                className={`eden-stage-animal-btn ${activeNpc === "fox" ? "eden-stage-animal--active" : ""}`}
                onClick={(e) => { e.stopPropagation(); if (activeNpc !== "fox") handleSelectNpc("fox"); }}
                aria-label="与狐狸低语"
                tabIndex={activeNpc === "fox" ? -1 : 0}
                style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer" }}
              >
                <span className="eden-animal-feedback">狐狸在树影里望着你。</span>
              </button>
              {activeNpc === "fox" && (
                <button
                  className="eden-btn eden-btn--suggestion eden-btn--fox-judge"
                  onClick={(e) => { e.stopPropagation(); handleNewToolCall("judge_whisper_style", "fox"); }}
                  disabled={isLoading || !playerInput.trim()}
                  aria-label="请狐狸评估这句低语"
                  style={{ marginTop: 8 }}
                >
                  🦊 评估话术
                </button>
              )}
            </div>
          )}

          {/* 新增 NPC 渲染 - 加百列（传达天使，伊甸之河白天） */}
          {currentNpcs.includes("gabriel") && (
            <button
              className={`eden-stage-angel eden-stage-angel--gabriel ${activeNpc === "gabriel" ? "eden-stage-angel--active" : ""}`}
              onClick={(e) => { e.stopPropagation(); if (activeNpc !== "gabriel") handleSelectNpc("gabriel"); }}
              aria-label="与加百列低语"
              tabIndex={activeNpc === "gabriel" ? -1 : 0}
            >
              <Image
                src={CHAPTER1_IMAGES.gabrielSprite}
                alt="加百列"
                width={1023}
                height={1537}
                className="eden-angel-stage-sprite"
              />
            </button>
          )}

          {/* 新增 NPC 渲染 - 拉斐尔（安抚天使，伊甸之河白天/夜晚） */}
          {currentNpcs.includes("raphael") && (
            <button
              className={`eden-stage-angel eden-stage-angel--raphael ${activeNpc === "raphael" ? "eden-stage-angel--active" : ""}`}
              onClick={(e) => { e.stopPropagation(); if (activeNpc !== "raphael") handleSelectNpc("raphael"); }}
              aria-label="与拉斐尔低语"
              tabIndex={activeNpc === "raphael" ? -1 : 0}
            >
              <Image
                src={CHAPTER1_IMAGES.raphaelSprite}
                alt="拉斐尔"
                width={1023}
                height={1537}
                className="eden-angel-stage-sprite"
              />
            </button>
          )}

          {/* 新增 NPC 渲染 - 乌列尔（光照天使，园中树林白天/夜晚） */}
          {currentNpcs.includes("uriel") && (
            <button
              className={`eden-stage-angel eden-stage-angel--uriel ${activeNpc === "uriel" ? "eden-stage-angel--active" : ""}`}
              onClick={(e) => { e.stopPropagation(); if (activeNpc !== "uriel") handleSelectNpc("uriel"); }}
              aria-label="与乌列尔低语"
              tabIndex={activeNpc === "uriel" ? -1 : 0}
            >
              <Image
                src={CHAPTER1_IMAGES.urielSprite}
                alt="乌列尔"
                width={1023}
                height={1537}
                className="eden-angel-stage-sprite"
              />
            </button>
          )}

          {/* 新增 NPC 渲染 - 米迦勒（后果天使，四河分流白天/夜晚） */}
          {currentNpcs.includes("michael") && (
            <button
              className={`eden-stage-angel eden-stage-angel--michael ${activeNpc === "michael" ? "eden-stage-angel--active" : ""}`}
              onClick={(e) => { e.stopPropagation(); if (activeNpc !== "michael") handleSelectNpc("michael"); }}
              aria-label="与米迦勒低语"
              tabIndex={activeNpc === "michael" ? -1 : 0}
            >
              <Image
                src={CHAPTER1_IMAGES.michaelSprite}
                alt="米迦勒"
                width={1023}
                height={1537}
                className="eden-angel-stage-sprite"
              />
            </button>
          )}

          {/* 新增 NPC 渲染 - 羊（万物受名处白天）- 暂时移除
          {currentNpcs.includes("sheep") && (
            <div className="eden-stage-animal eden-stage-sheep">
              <span className="eden-animal-feedback">羊群在草地上安静地吃草。</span>
            </div>
          )}*/}

          {/* 新增世界对象 - 生命树（园子中央白天/夜晚，不可低语，纯场景元素） */}
          {currentNpcs.includes("tree_of_life") && (
            <div className="eden-stage-world-object eden-stage-tree-of-life" />
          )}

          {/* 草叶前景遮罩 */}
          <div className="eden-grass-foreground" />
        </section>
      </main>

      {/* 左侧园中回响面板 */}
      {resonancePanelOpen && (
        <aside className="eden-resonance-panel">
          <div className="eden-resonance-panel-header">
            <span className="eden-resonance-panel-title">园中回响</span>
            <button
              className="eden-panel-close-btn"
              type="button"
              onClick={() => setResonancePanelOpen(false)}
              aria-label="关闭回响面板"
            >
              ×
            </button>
          </div>
          <div className="eden-resonance-panel-content">
            {state.inventory.filter(id => (state.itemCounts[id] ?? 0) > 0).length === 0 ? (
              <p className="eden-empty-hint">你还没有获得任何回响。</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {state.inventory.filter(id => (state.itemCounts[id] ?? 0) > 0).map((itemId) => {
                  const item = getItemById(itemId);
                  if (!item) return null;
                  const count = state.itemCounts[itemId] ?? 0;
                  const isPrepared = state.preparedResonanceId === itemId;
                  return (
                    <div key={itemId} className={`eden-resonance-card ${isPrepared ? "eden-resonance-card--prepared" : ""}`}>
                      <div className="eden-resonance-card-header">
                        <span className="eden-resonance-card-name">
                          {item.icon && <span className="eden-resonance-card-icon">{item.icon}</span>}
                          {isPrepared && <span className="eden-resonance-card-prepared-mark">⟡ 已准备</span>}
                          {item.title}
                        </span>
                        <span className="eden-resonance-card-count">×{count}</span>
                      </div>
                      <p className="eden-resonance-card-desc">{item.shortEffect}</p>
                      <p className="eden-resonance-card-source">来源：{item.sourceName}（{item.sourceType === "angel" ? "天使" : item.sourceType === "character" ? "角色" : item.sourceType === "scene" ? "场景" : "神明"}）</p>
                      <div className="eden-resonance-card-actions">
                        {item.kind === "prepared" && !isPrepared && count > 0 && (
                          <button
                            className="eden-btn eden-btn--resonance-action"
                            onClick={() => handleToolCall("prepare_resonance", { itemId })}
                            disabled={isLoading || !!state.preparedResonanceId}
                            title={state.preparedResonanceId ? "请先取消当前准备的回响" : "准备此回响，绑定到下一次匹配的行动"}
                          >
                            准备
                          </button>
                        )}
                        {item.kind === "prepared" && isPrepared && (
                          <button
                            className="eden-btn eden-btn--resonance-action eden-btn--resonance-cancel"
                            onClick={() => handleToolCall("cancel_prepared_resonance", {})}
                            disabled={isLoading}
                            title="取消准备"
                          >
                            取消准备
                          </button>
                        )}
                        {item.kind === "instant" && count > 0 && (
                          <button
                            className="eden-btn eden-btn--resonance-action eden-btn--resonance-use"
                            onClick={() => handleToolCall("use_resonance", { itemId })}
                            disabled={isLoading}
                            title={item.shortEffect}
                          >
                            使用
                          </button>
                        )}
                        {item.kind === "consumable" && count > 0 && (
                          <button
                            className="eden-btn eden-btn--resonance-action eden-btn--resonance-use"
                            onClick={() => handleToolCall("use_resonance", { itemId })}
                            disabled={isLoading}
                            title={item.shortEffect}
                          >
                            使用
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {/* 当前绑定提示 */}
          {state.preparedResonanceId && (
            <div className="eden-resonance-binding-hint">
              已准备：{getItemById(state.preparedResonanceId)?.title ?? state.preparedResonanceId}
              <br />
              将在匹配的「{getItemById(state.preparedResonanceId)?.bindTargets?.join(" / ") ?? ""}」行动时生效。
            </div>
          )}
          {state.pendingConsumableEffects && state.pendingConsumableEffects.length > 0 && (
            <div className="eden-resonance-binding-hint eden-resonance-binding-hint--consumable">
              ⟡ 已使用 {state.pendingConsumableEffects.length} 个消耗品：
              {state.pendingConsumableEffects.map((e, i) => (
                <span key={i}>{getItemById(e.itemId)?.title ?? e.itemId}{i < state.pendingConsumableEffects.length - 1 ? "、" : ""}</span>
              ))}
              <br />
              将在下一次行动时全部自动生效。
            </div>
          )}
        </aside>
      )}

      {/* 神明献礼通知 */}
      {divineGiftToast && (
        <div className="eden-divine-gift-toast">
          <div className="eden-divine-gift-toast-icon">✦</div>
          <div className="eden-divine-gift-toast-content">
            <p className="eden-divine-gift-toast-title">神明献礼</p>
            <p className="eden-divine-gift-toast-name">{divineGiftToast.giftName}</p>
            <p className="eden-divine-gift-toast-desc">{divineGiftToast.narration}</p>
            {divineGiftToast.hint && (
              <p className="eden-divine-gift-toast-hint">{divineGiftToast.hint}</p>
            )}
          </div>
        </div>
      )}

      {/* 行动点耗尽提示 */}
      {apDepletedToast.visible && (
        <div className={`eden-ap-depleted-toast ${apDepletedToast.hiding ? "eden-ap-toast-hiding" : ""}`}>
          <button
            className="eden-ap-depleted-toast-close"
            type="button"
            onClick={() => setApDepletedToast({ visible: false, hiding: false })}
            aria-label="关闭提示"
          >
            ×
          </button>
          <div className="eden-ap-depleted-toast-icon">✦</div>
          <div className="eden-ap-depleted-toast-content">
            <p className="eden-ap-depleted-toast-title">行动已用尽</p>
            <p className="eden-ap-depleted-toast-desc">
              这一时段的行动点已用完，请点击顶部「进入下一轮」恢复行动。
            </p>
            <p className="eden-ap-depleted-toast-hint">
              新的时段将恢复5点行动点。
            </p>
          </div>
        </div>
      )}

      {/* 回响获得通知 */}
      {resonanceGainedToast && (
        <div className="eden-resonance-gained-toast">
          <div className="eden-resonance-gained-toast-icon">⟡</div>
          <div className="eden-resonance-gained-toast-content">
            <p className="eden-resonance-gained-toast-title">获得回响</p>
            <p className="eden-resonance-gained-toast-name">{resonanceGainedToast.title}</p>
            <p className="eden-resonance-gained-toast-desc">{resonanceGainedToast.narration}</p>
          </div>
        </div>
      )}

      {/* 右侧浮窗面板（可关闭 / 可拖动 / 可拉伸） */}
      {isWorldPanelOpen && (
      <aside
        ref={worldPanelRef}
        className={`eden-float-panel eden-world-panel ${isWorldPanelDragging ? "eden-float-panel--dragging" : ""}`}
        style={worldPanelStyle}
      >
        <div
          className="eden-panel-drag-bar eden-panel-drag-bar--world"
          onPointerDown={handleWorldPanelDragStart}
          onPointerMove={handleWorldPanelDragMove}
          onPointerUp={handleWorldPanelDragEnd}
          onPointerCancel={handleWorldPanelDragEnd}
        >
          <div>
            <span className="eden-panel-drag-title">对话框</span>
            <span className="eden-panel-drag-hint">拖动顶部移动，拖拽右下角调整大小</span>
          </div>
          <button
            className="eden-panel-close-btn"
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setWorldPanelOpen(false)}
            aria-label="关闭对话框"
          >
            ×
          </button>
        </div>
        {/* Tab 栏 */}
        <div className="eden-panel-tabs">
          {([
            ["dialogue", "对话"],
            ["mind", "属性"],
            ["serpent", "蛇（我）"],
            ["clues", "线索与记录"],
          ] as [PanelTab, string][]).map(([tab, label]) => (
            <button
              key={tab}
              className={`eden-tab-btn ${activeTab === tab ? "eden-tab-btn--active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="eden-panel-content">
          {/* ===== 对话 Tab ===== */}
          {activeTab === "dialogue" && (
            <div className="eden-dialogue-flow">
              {/* 神的注视叙事 */}
              <div className="eden-divine-narration" style={{ marginTop: 4 }}>
                {divineNarrationText}
              </div>

              {/* 时段推进叙事 */}
              {slotNarrations && slotNarrations.length > 0 && (
                <div className="eden-memory-narration" style={{ marginTop: 8 }}>
                  {slotNarrations.map((n, i) => (
                    <p key={i} style={{ margin: 0 }}>{n}</p>
                  ))}
                </div>
              )}

              {/* 印记解锁提示 */}
              {achievementToast && (
                <div className="eden-achievement-toast" style={{ marginTop: 8 }}>
                  {achievementToast}
                </div>
              )}

              {/* 对话历史 */}
              {activeNpc && (
                <>
                  <p className="eden-section-title" style={{ marginTop: 12 }}>
                    对 {NPC_NAMES[activeNpc]} 低语
                  </p>
                  {currentHistory.map((entry, i) => (
                    <div
                      key={i}
                      className={`eden-dialogue-entry eden-dialogue-${entry.role === "serpent" ? "serpent" : "eve"}`}
                    >
                      {entry.role === "serpent" && (
                        <span className="eden-dialogue-role eden-dialogue-role--serpent">蛇</span>
                      )}
                      {entry.role === "npc" && (
                        <span className="eden-dialogue-role eden-dialogue-role--eve">{NPC_NAMES[activeNpc]}</span>
                      )}
                      <span className={`eden-dialogue-text eden-dialogue-text--${entry.role === "serpent" ? "serpent" : "eve"}`}>
                        {entry.text}
                      </span>
                    </div>
                  ))}

                  {/* 当前回复 */}
                  {currentReply && !currentHistory.some((e) => e.role === "npc" && e.text === currentReply) && (
                    <div className="eden-dialogue-entry eden-dialogue-eve">
                      <span className="eden-dialogue-role eden-dialogue-role--eve">{NPC_NAMES[activeNpc]}</span>
                      <span className="eden-dialogue-text eden-dialogue-text--eve">{currentReply}</span>
                    </div>
                  )}

                  {/* 工具叙事（自我意识路径转折） */}
                  {toolNarration && (
                    <div className="eden-memory-narration" key={toolNarration}>
                      {toolNarration}
                    </div>
                  )}

                  {/* 刺猬环境反馈 */}
                  {hedgehogNarration && (
                    <div className="eden-hedgehog-narration" key={hedgehogNarration}>
                      {hedgehogNarration}
                    </div>
                  )}

                  {/* 加载指示 */}
                  {isLoading && (
                    <div className="eden-system-hint eden-system-hint--loading">
                      {NPC_NAMES[activeNpc]}在思考⋯⋯
                    </div>
                  )}
                </>
              )}

              {/* 同 NPC 对话上限提示 */}
              {activeNpc && hasWhisperedToActiveNpc && (
                <div className="eden-system-hint eden-system-hint--warning" style={{ marginTop: 8 }}>
                  {activeNpc === "eve"
                    ? "她已经听得太久了。再说下去，只会让她退回沉默。"
                    : `这一轮你已经对${NPC_NAMES[activeNpc]}说得太多。等风换一个方向，再回来。`}
                </div>
              )}

              {/* 系统提示 */}
              {systemHint && (
                <div className="eden-system-hint">{systemHint}</div>
              )}

              {!activeNpc && !systemHint && (
                <div className="eden-system-hint">
                  选择一个角色开始低语，或点击顶部「地图」前往其他地点。
                </div>
              )}

              <div ref={dialogueEndRef} />
            </div>
          )}

          {/* ===== 属性 Tab：此处可见 + 角色属性面板 ===== */}
          {activeTab === "mind" && (
            <div className="eden-character-panel">
              {/* 此处可见（属性 Tab 顶部） */}
              <div className="eden-location-npcs">
                <p className="eden-section-title">此处可见</p>
                {currentNpcs.length === 0 ? (
                  <p className="eden-empty-hint">这里没有可以低语的对象。</p>
                ) : (
                  <div className="eden-world-whisper-list">
                    {/* 可低语 NPC：正常按钮 */}
                    {currentNpcs.filter(npcId => EDEN_NPCS[npcId].canWhisper).map((npcId) => {
                      const meta = EDEN_NPCS[npcId];
                      return (
                        <button
                          key={npcId}
                          className={`eden-btn eden-btn--suggestion ${(mindTabNpc ?? activeNpc) === npcId ? "eden-btn--suggestion-classic" : ""}`}
                          onClick={() => setSelectedMindNpc(npcId)}
                          title={meta.shortDesc}
                        >
                          {meta.name}
                        </button>
                      );
                    })}
                    {/* 不可低语动物/对象：灰色 chip */}
                    {currentNpcs.filter(npcId => !EDEN_NPCS[npcId].canWhisper).map((npcId) => {
                      const meta = EDEN_NPCS[npcId];
                      return (
                        <span
                          key={npcId}
                          className="eden-npc-chip eden-npc-chip--observer"
                          title={meta.shortDesc}
                        >
                          {meta.name}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 选中角色属性 */}
              {mindTabNpc ? (
                (() => {
                  const profile = buildAttributeProfile(mindTabNpc, state);
                  return (
                    <>
                      <div className="eden-character-header" style={{ marginTop: 12 }}>
                        <div>
                          <p className="eden-section-title">角色属性</p>
                          <p className="eden-character-name">{profile.title}</p>
                        </div>
                        <span className="eden-character-status">在{LOCATION_NAMES[state.npcLocations[mindTabNpc]]}</span>
                      </div>
                      <p className="eden-character-desc">{profile.summary}</p>
                      <div className="eden-skills-list">
                        {profile.notes.map((note) => (
                          <span key={note} className="eden-skill-chip">{note}</span>
                        ))}
                      </div>
                      <p className="eden-empty-hint" style={{ margin: 0 }}>
                        {profile.subtitle}
                      </p>
                      <div className="eden-psyche-display-grid">
                        {profile.rows.map((row) => (
                          <div key={row.label} className="eden-psyche-info-row">
                            <span className="eden-psyche-label">{row.label}</span>
                            <div className="eden-psyche-bar-bg">
                              <div
                                className={`eden-psyche-bar-fill eden-psyche-bar-fill--${row.tone}`}
                                style={{ width: `${clampPercent(row.value)}%` }}
                              />
                            </div>
                            <span className="eden-psyche-value">{Math.round(row.value)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()
              ) : (
                <div className="eden-empty-state">
                  <p className="eden-empty-state-icon">🐍</p>
                  <p className="eden-empty-hint">请选择一个角色查看属性</p>
                  <p className="eden-empty-sub">点击上方「此处可见」中的角色，查看他们的属性与弱点。</p>
                </div>
              )}
            </div>
          )}

          {/* ===== 蛇（我）Tab：玩家自身状态 ===== */}
          {activeTab === "serpent" && (
            <div className="eden-character-panel">
              <div className="eden-character-header">
                <div>
                  <p className="eden-section-title">蛇（我）</p>
                  <p className="eden-character-name">草叶下的低语</p>
                </div>
                <span className="eden-character-status">时段 {state.timeSlot}/12 · 行动 {state.actionPoints}/{state.maxActionPoints}</span>
              </div>

              <p className="eden-character-desc">
                你没有手，不能触碰果子，也不能替任何人做出选择。你的力量只剩语言——以及耐心。每一轮你有 {state.maxActionPoints} 点行动，用于移动、低语或场景互动。行动点用尽后，需要主动进入下一轮才能恢复。
              </p>

              {/* 当前回响Buff显示 */}
              <div style={{ marginTop: 16 }}>
                <p className="eden-section-title">当前回响赋予的Buff</p>

                {/* 已准备的回响 */}
                {state.preparedResonanceId && (
                  <div style={{ padding: "10px 12px", background: "rgba(180,150,80,0.15)", borderRadius: 6, border: "1px solid rgba(160,138,80,0.25)", marginBottom: 8 }}>
                    <p style={{ color: "#e8d8a0", fontSize: "0.9rem", margin: "0 0 4px" }}>
                      ⟡ 已准备：{getItemById(state.preparedResonanceId)?.title || state.preparedResonanceId}
                    </p>
                    <p style={{ color: "#8a9a7a", fontSize: "0.8rem", margin: 0 }}>
                      {getItemById(state.preparedResonanceId)?.shortEffect || "将在下次匹配行动中生效"}
                    </p>
                  </div>
                )}

                {/* 待生效的消耗品 */}
                {state.pendingConsumableEffects && state.pendingConsumableEffects.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    {state.pendingConsumableEffects.map((effect, i) => {
                      const item = getItemById(effect.itemId);
                      return (
                        <div key={i} style={{ padding: "10px 12px", background: "rgba(100,150,100,0.12)", borderRadius: 6, border: "1px solid rgba(100,138,100,0.25)", marginBottom: i < state.pendingConsumableEffects.length - 1 ? 6 : 0 }}>
                          <p style={{ color: "#c8e0c0", fontSize: "0.9rem", margin: "0 0 4px" }}>
                            {item?.icon || "⬡"} {item?.title || effect.itemId}
                          </p>
                          <p style={{ color: "#8a9a7a", fontSize: "0.8rem", margin: 0 }}>
                            {item?.shortEffect || "将在下次行动中生效"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 永久被动道具 */}
                {(() => {
                  const passiveItems = state.inventory.filter(id => {
                    const item = getItemById(id);
                    return item?.kind === "passive";
                  });
                  if (passiveItems.length === 0) return null;
                  return (
                    <div>
                      {passiveItems.map((itemId, i) => {
                        const item = getItemById(itemId);
                        return (
                          <div key={i} style={{ padding: "10px 12px", background: "rgba(80,120,200,0.1)", borderRadius: 6, border: "1px solid rgba(80,120,200,0.22)", marginBottom: 6 }}>
                            <p style={{ color: "#c0d0f0", fontSize: "0.9rem", margin: "0 0 4px" }}>
                              {item?.icon || "✨"} 永久被动：{item?.title}
                            </p>
                            <p style={{ color: "#8a9a7a", fontSize: "0.8rem", margin: 0 }}>
                              {item?.shortEffect}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* 如果没有任何Buff，显示提示 */}
                {!state.preparedResonanceId && (!state.pendingConsumableEffects || state.pendingConsumableEffects.length === 0) &&
                 state.inventory.filter(id => getItemById(id)?.kind === "passive").length === 0 && (
                  <p className="eden-empty-hint">
                    你还没有激活任何回响Buff。在场景中探索或使用道具来获得Buff。
                  </p>
                )}
              </div>

              <p className="eden-section-title" style={{ marginTop: 16 }}>
                {serpentTokenStats.lastWasEstimated ? "词元消耗（估算）" : "词元消耗"}
              </p>
              <div className="eden-serpent-token-card">
                <div className="eden-token-row">
                  <span>本轮消耗</span>
                  <strong>{serpentTokenStats.lastTotal}</strong>
                </div>
                <div className="eden-token-row">
                  <span>总消耗</span>
                  <strong>{serpentTokenStats.total}</strong>
                </div>
              </div>
            </div>
          )}

          {/* ===== 线索与记录 Tab ===== */}
          {activeTab === "clues" && (
            <div className="eden-character-panel">
              <p className="eden-section-title">已发现线索（{state.discoveredClues.length}）</p>
              {state.discoveredClues.length === 0 ? (
                <p className="eden-empty-hint">你还没有发现任何线索。观察地点、与不同角色对话，或许能发现他们的弱点。</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {state.discoveredClues.map((clueId) => {
                    const clue = getClueById(clueId);
                    if (!clue) return null;
                    return (
                      <div key={clueId} style={{ padding: "10px 12px", background: "rgba(22,32,26,0.4)", borderRadius: 6, border: "1px solid rgba(160,138,80,0.15)" }}>
                        <p style={{ color: "#d8c8a0", fontSize: "0.9rem", margin: "0 0 4px" }}>{clue.title}</p>
                        <p style={{ color: "#8a9a7a", fontSize: "0.8rem", margin: 0, lineHeight: 1.6 }}>{clue.description}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 感兴趣的内容：标签形式 */}
              <p className="eden-section-title" style={{ marginTop: 16 }}>感兴趣的内容</p>
              {activeNpc ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {(() => {
                    const interestTags: Record<EdenNpcId, Array<{ text: string; color?: string }>> = {
                      eve: [
                        { text: "死亡", color: "rgba(200, 120, 80, 0.2)" },
                        { text: "善恶", color: "rgba(180, 150, 90, 0.2)" },
                        { text: "像神", color: "rgba(200, 180, 100, 0.2)" },
                        { text: "自己", color: "rgba(150, 180, 130, 0.2)" },
                        { text: "判断", color: "rgba(130, 170, 150, 0.2)" },
                      ],
                      adam: [
                        { text: "命令", color: "rgba(140, 140, 180, 0.2)" },
                        { text: "牵挂", color: "rgba(180, 140, 170, 0.2)" },
                        { text: "夏娃", color: "rgba(200, 150, 180, 0.2)" },
                        { text: "相信", color: "rgba(160, 170, 140, 0.2)" },
                      ],
                      hedgehog: [
                        { text: "安静", color: "rgba(150, 170, 120, 0.2)" },
                        { text: "草叶", color: "rgba(120, 150, 90, 0.2)" },
                        { text: "声音", color: "rgba(140, 160, 130, 0.2)" },
                      ],
                      watching_angel: [
                        { text: "边界", color: "rgba(150, 150, 170, 0.2)" },
                        { text: "风", color: "rgba(130, 150, 160, 0.2)" },
                        { text: "注视", color: "rgba(180, 150, 150, 0.2)" },
                      ],
                      gabriel: [
                        { text: "声音", color: "rgba(160, 170, 200, 0.2)" },
                        { text: "传话", color: "rgba(150, 180, 200, 0.2)" },
                        { text: "水流", color: "rgba(130, 170, 190, 0.2)" },
                      ],
                      raphael: [
                        { text: "安抚", color: "rgba(140, 190, 170, 0.2)" },
                        { text: "平静", color: "rgba(130, 180, 180, 0.2)" },
                        { text: "鹿", color: "rgba(150, 170, 160, 0.2)" },
                      ],
                      uriel: [
                        { text: "光", color: "rgba(200, 180, 120, 0.2)" },
                        { text: "分辨", color: "rgba(180, 170, 100, 0.2)" },
                        { text: "提问", color: "rgba(160, 180, 120, 0.2)" },
                      ],
                      michael: [
                        { text: "选择", color: "rgba(150, 150, 180, 0.2)" },
                        { text: "后果", color: "rgba(170, 140, 160, 0.2)" },
                        { text: "分流", color: "rgba(140, 160, 180, 0.2)" },
                      ],
                      cherubim: [
                        { text: "东门", color: "rgba(180, 160, 140, 0.2)" },
                        { text: "道路", color: "rgba(160, 150, 130, 0.2)" },
                        { text: "守卫", color: "rgba(170, 150, 150, 0.2)" },
                      ],
                      fox: [
                        { text: "话术", color: "rgba(180, 120, 140, 0.2)" },
                        { text: "判断", color: "rgba(160, 140, 150, 0.2)" },
                        { text: "评价", color: "rgba(170, 130, 140, 0.2)" },
                      ],
                      deer: [
                        { text: "视线", color: "rgba(140, 170, 150, 0.2)" },
                        { text: "树林", color: "rgba(120, 160, 130, 0.2)" },
                        { text: "安静", color: "rgba(130, 170, 140, 0.2)" },
                      ],
                      dove: [
                        { text: "传话", color: "rgba(180, 180, 190, 0.2)" },
                        { text: "夜晚", color: "rgba(100, 110, 140, 0.2)" },
                        { text: "温和", color: "rgba(170, 190, 180, 0.2)" },
                      ],
                      sheep: [
                        { text: "园子", color: "rgba(150, 180, 130, 0.2)" },
                        { text: "温和", color: "rgba(160, 190, 150, 0.2)" },
                        { text: "草地", color: "rgba(130, 160, 110, 0.2)" },
                      ],
                      tree_of_life: [],
                      forbidden_tree: [],
                    };
                    const tagExamples: Record<EdenNpcId, Record<string, string>> = {
                      eve: {
                        "死亡": "你知道死究竟是什么吗？",
                        "善恶": "如果不明白善恶，怎么知道服从是善？",
                        "像神": "你不想变得像神一样，知道更多吗？",
                        "自己": "你难道不想自己做一次判断吗？",
                        "判断": "为什么神不让你自己判断呢？",
                      },
                      adam: {
                        "命令": "神的命令，你就从来没有怀疑过吗？",
                        "牵挂": "你那么牵挂她，难道不想让她更明白吗？",
                        "夏娃": "如果夏娃想知道更多，你会阻拦她吗？",
                        "相信": "你更相信神说的，还是她想的？",
                      },
                    };
                    return interestTags[activeNpc]?.map((item, i) => (
                      <button
                        key={i}
                        className="eden-btn eden-btn--suggestion"
                        onClick={() => {
                          setPlayerInput(tagExamples[activeNpc as keyof typeof tagExamples]?.[item.text] || "");
                          setTimeout(() => textareaRef.current?.focus(), 0);
                        }}
                        disabled={isLoading}
                        style={{
                          padding: "6px 16px",
                          fontSize: "13px",
                          borderRadius: "16px",
                          minWidth: "auto",
                          background: item.color || "rgba(160, 138, 80, 0.1)",
                          borderColor: item.color ? item.color.replace("0.2", "0.3") : undefined,
                        }}
                      >
                        {item.text}
                      </button>
                    )) || [];
                  })()}
                </div>
              ) : (
                <p className="eden-empty-hint">先选择一个低语对象来查看推荐内容。</p>
              )}

              {/* 可行动作（场景互动）—— 样式统一为普通按钮 */}
              {isExploreActive && (
                <div style={{ marginTop: 16 }}>
                  <p className="eden-section-title">可行动作</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {availableSceneActions.length === 0 ? (
                      <p className="eden-empty-hint" style={{ margin: 0 }}>当前地点暂无可执行的场景动作。</p>
                    ) : (
                      availableSceneActions.map((action) => {
                        const hasItemReward = action.rewards.itemIds && action.rewards.itemIds.length > 0;
                        return (
                          <button
                            key={action.id}
                            className="eden-btn eden-btn--suggestion"
                            onClick={() => handleToolCall("scene_action", { sceneActionId: action.id })}
                            disabled={isLoading || state.actionPoints < action.apCost}
                            title={action.description}
                            style={{
                              position: "relative",
                              justifyContent: "space-between",
                            }}
                          >
                            <span>{action.label}（{action.apCost}点）</span>
                            {hasItemReward && (
                              <span style={{
                                fontSize: "11px",
                                opacity: 0.9,
                                padding: "2px 8px",
                                borderRadius: "10px",
                                background: "rgba(200, 170, 90, 0.15)",
                                border: "1px solid rgba(200, 170, 90, 0.25)",
                              }}>
                                ✨ 获回响
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                  {state.actionPoints <= 0 && (
                    <p className="eden-empty-hint" style={{ marginTop: 6 }}>
                      本轮行动已用尽。点击顶部「进入下一轮」恢复行动点。
                    </p>
                  )}
                </div>
              )}

              {state.npcDialogues.length > 0 && (
                <>
                  <p className="eden-section-title" style={{ marginTop: 16 }}>他们之间的对话</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {state.npcDialogues.map((dlg, i) => (
                      <div key={i} style={{ padding: "8px 12px", background: "rgba(22,32,26,0.3)", borderRadius: 6 }}>
                        <p style={{ color: "#a89878", fontSize: "0.74rem", margin: "0 0 4px" }}>
                          第 {dlg.turn} 轮 · {NPC_NAMES[dlg.speakerId]} → {NPC_NAMES[dlg.targetId]}
                        </p>
                        <p style={{ color: "#b8b8a4", fontSize: "0.8rem", margin: 0, lineHeight: 1.6 }}>
                          {dlg.narration}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </aside>
      )}

      {/* 地图弹层 */}
      {mapModalOpen && (
        <div className="eden-map-modal">
          <button
            className="eden-map-backdrop"
            onClick={() => setMapModalOpen(false)}
            aria-label="关闭地图"
          />
          <div className="eden-map-sheet">
            <div className="eden-map-sheet-header">
              <div>
                <span className="eden-map-kicker">伊甸园</span>
                <h2 className="eden-map-title">前往一个地方</h2>
              </div>
              <button
                className="eden-map-close"
                onClick={() => setMapModalOpen(false)}
                aria-label="关闭地图"
              >
                ×
              </button>
            </div>

            {/* 地图大图 + 热点（点击只选中，不移动） */}
            <div className="eden-map-image-wrap" style={{ position: "relative" }}>
              <Image
                src={CHAPTER1_IMAGES.edenWorldMap}
                alt="伊甸园地图"
                fill
                sizes="90vw"
                style={{ objectFit: "contain" }}
                className="eden-map-image"
              />
              {(Object.keys(EDEN_LOCATIONS) as EdenLocationId[]).map((locId) => {
                const loc = EDEN_LOCATIONS[locId];
                const isCurrent = locId === state.locationId;
                const isSelected = locId === selectedMapLocationId;
                const isReachable = currentLocation.connections.includes(locId);
                const pos = MAP_HOTSPOTS[locId];
                if (!pos) return null;
                // 当前位置实心圈优先；否则选中状态外圈加亮；可达亮色空心；不可达红色空心
                const hotspotClass = [
                  "eden-map-hotspot",
                  pos.labelOffset === "top" ? "eden-map-hotspot--label-top" : "eden-map-hotspot--label-bottom",
                  isCurrent ? "eden-map-hotspot--current" : "",
                  isSelected && !isCurrent ? "eden-map-hotspot--selected" : "",
                  !isReachable && !isCurrent ? "eden-map-hotspot--locked" : "",
                ].filter(Boolean).join(" ");
                return (
                  <button
                    key={locId}
                    className={hotspotClass}
                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    onClick={() => handleMapLocationClick(locId)}
                    disabled={isLoading}
                    aria-label={`选中${loc.name}`}
                  >
                    <span className="eden-map-hotspot-label">{loc.name}</span>
                    <span className="eden-map-hotspot-state">
                      {isCurrent ? "你在这里" : isReachable ? "可前往" : "需绕行"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 选中地点详情框（单个，取代原五卡片网格） */}
            {(() => {
              const selectedLoc = EDEN_LOCATIONS[selectedMapLocationId];
              const status = getMapTravelStatus(selectedMapLocationId, state.locationId);
              const canEnter = status.kind === "reachable" && !isLoading;
              // 根据当前昼夜获取该地点的 NPC 列表
              const timeNpcs = state.timeOfDay === "day" ? selectedLoc.dayNpcs : selectedLoc.nightNpcs;
              const whisperableNpcs = timeNpcs.filter((id) => id !== "forbidden_tree" && id !== "tree_of_life");
              const worldObjects = timeNpcs.filter((id) => id === "forbidden_tree" || id === "tree_of_life");
              return (
                <div className="eden-map-detail">
                  <div className="eden-map-detail-info">
                    <span className="eden-map-detail-name">{selectedLoc.name}</span>
                    <span className="eden-map-detail-desc">{selectedLoc.shortDesc}</span>
                    <span className="eden-map-detail-status">{status.label}</span>
                  </div>
                  {/* 此时可见 NPC 列表 */}
                  <div className="eden-map-npc-list">
                    <span className="eden-map-npc-list-title">此时可见</span>
                    <div className="eden-map-npc-chips">
                      {whisperableNpcs.length === 0 && worldObjects.length === 0 && (
                        <span className="eden-map-npc-chip eden-map-npc-chip--empty">无</span>
                      )}
                      {whisperableNpcs.map((npcId) => (
                        <span
                          key={npcId}
                          className={`eden-map-npc-chip ${EDEN_NPCS[npcId].canWhisper ? "eden-map-npc-chip--whisperable" : "eden-map-npc-chip--non-whisperable"}`}
                          title={EDEN_NPCS[npcId].shortDesc}
                        >
                          {EDEN_NPCS[npcId].name}
                        </span>
                      ))}
                      {worldObjects.map((objId) => (
                        <span
                          key={objId}
                          className="eden-map-npc-chip eden-map-npc-chip--world-object"
                          title={EDEN_NPCS[objId].shortDesc}
                        >
                          {EDEN_NPCS[objId].name}（世界对象）
                        </span>
                      ))}
                    </div>
                  </div>
                  {status.kind === "current" && (
                    <span className="eden-map-detail-badge eden-map-detail-badge--current">当前位置</span>
                  )}
                  {status.kind === "reachable" && (
                    <button
                      className="eden-btn eden-btn--primary eden-map-detail-action"
                      onClick={handleMapConfirmEnter}
                      disabled={!canEnter}
                    >
                      进入
                    </button>
                  )}
                  {status.kind === "blocked" && (
                    <span className="eden-map-detail-badge eden-map-detail-badge--blocked">无法进入</span>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 园中印记独立浮窗 */}
      {achievementModalOpen && (
        <div className="eden-achievement-modal">
          <button
            className="eden-map-backdrop"
            onClick={() => setAchievementModalOpen(false)}
            aria-label="关闭园中印记"
          />
          <div className="eden-achievement-sheet">
            <div className="eden-achievement-sheet-header">
              <div>
                <span className="eden-map-kicker">园中印记</span>
                <h2 className="eden-map-title">已解锁 {state.unlockedAchievementIds.length}/{ACHIEVEMENTS.length}</h2>
              </div>
              <button
                className="eden-map-close"
                onClick={() => setAchievementModalOpen(false)}
                aria-label="关闭园中印记"
              >
                ×
              </button>
            </div>
            <div className="eden-achievement-sheet-content">
              {ACHIEVEMENTS.map((ach) => {
                const unlocked = state.unlockedAchievementIds.includes(ach.id);
                return (
                  <div
                    key={ach.id}
                    className={`eden-achievement-card ${unlocked ? "eden-achievement-card--unlocked" : "eden-achievement-card--locked"}`}
                  >
                    <p className="eden-achievement-card-name">
                      {unlocked ? "✦" : "○"} {ach.name}
                    </p>
                    <p className="eden-achievement-card-desc">
                      {unlocked ? ach.desc : "尚未解锁"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 输入区（固定底部，与教程统一） */}
      {isExploreActive && (
        <footer className="eden-input-footer">
          {/* 推荐低语（输入框上方） */}
          {activeNpc && recommendedWhispers.length > 0 && (
            <div className="eden-input-suggestions">
              <span className="eden-input-suggestions-label">可尝试低语</span>
              {recommendedWhispers.slice(0, 2).map((line) => (
                <button
                  key={line}
                  className="eden-input-suggestion-btn"
                  onClick={() => {
                    setPlayerInput(line);
                    setTimeout(() => textareaRef.current?.focus(), 0);
                  }}
                  disabled={isLoading}
                >
                  {line}
                </button>
              ))}
            </div>
          )}
          <div className="eden-input-area">
            <textarea
              ref={textareaRef}
              className="eden-player-input"
              value={playerInput}
              onChange={(e) => setPlayerInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                !activeNpc
                  ? "先选择一个低语对象⋯⋯"
                  : isLoading
                  ? `${activeNpcMeta ? activeNpcMeta.name : "对方"}在思考⋯⋯`
                  : `对${activeNpcMeta ? activeNpcMeta.name : "对方"}低语⋯⋯`
              }
              autoFocus
              maxLength={300}
              disabled={isLoading || !activeNpc}
              rows={1}
            />
            <button
              className="eden-btn eden-btn--send"
              onClick={handleSubmit}
              disabled={isLoading || !activeNpc}
            >
              {isLoading ? "⋯" : "发送"}
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
