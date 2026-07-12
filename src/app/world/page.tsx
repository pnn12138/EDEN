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
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  initialEdenWorldState,
  DIVINE_ATTENTION_NARRATIONS,
  type EdenWorldState,
  type EdenNpcId,
  type EdenLocationId,
  type TimeOfDay,
  type TimeSlot,
  type DivineGiftId,
} from "@/game/world/types";
import { allocateStageSlots } from "@/game/world/stageSlots";
import {
  rollGiftChoices,
  getGiftMeta,
  getEffectiveDivineThreshold,
} from "@/game/world/divineGiftRules";
import { getEffectiveMaxActionPoints } from "@/game/world/actionPointRules";
import { EDEN_LOCATIONS, LOCATION_NAMES } from "@/content/world/locations";
import { EDEN_NPCS, NPC_NAMES, getTreeDisplayName } from "@/content/world/npcs";
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
import ScenePuzzleModal from "@/components/world/ScenePuzzleModal";
import {
  SCENE_PUZZLES,
  getScenePuzzleById,
  type ScenePuzzle,
} from "@/content/world/scenePuzzles";
import { getNpcRelationProfile } from "@/content/world/npcRelations";
import {
  getAvailableEnterPuzzle,
  normalizePuzzleState,
  type ScenePuzzleAnswerResult,
} from "@/game/world/puzzleRules";
import InventoryPanel from "@/components/world/InventoryPanel";
import DivineAttentionViz from "@/components/world/DivineAttentionViz";
import SettingsModal from "@/components/world/SettingsModal";
import LoginModal from "@/components/world/LoginModal";
import { getAuth, logout, type AuthState } from "@/lib/auth";
import AchievementGarden from "@/components/world/AchievementGarden";
import {
  getUnlockedCrossSessionMarkIds,
  syncFromWorldState,
} from "@/services/achievement/globalTracker";
import NpcStatusHint from "@/components/world/NpcStatusHint";
import { computeWhisperFeedback } from "@/content/world/whisperFeedback";
import { useWorldSave, type SaveSlotIndex, type SaveSlotMeta } from "@/hooks/useWorldSave";
import { recordEncounterForVisibleNpcs } from "@/game/world/npcRelationRules";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";

// ---- 对话历史条目（按 NPC 区分） ----
type HistoryEntry = { role: "serpent" | "npc"; text: string };

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
  divineGiftChoice?: string[] | null;
  resonanceNarration?: string | null;
  resonanceGained?: {
    itemId: string;
    title: string;
    narration: string;
  } | null;
  toolResult?: WorldNpcToolResult | null;
  // 第一章：关系/好感自然反馈与言语分裂惩罚
  npcFeedback?: string | null;
  languagePunishment?: {
    angelId: string;
    displayName: string;
    narration: string;
  } | null;
  // 任务 6：跨场景低语扣除目标敬畏的实际值（仅跨场景时 > 0）
  aweReduction?: number;
};

type WorldNpcToolResult = {
    executed?: boolean;
    toolName: string;
    itemId?: string;
    itemTitle?: string;
    narration: string;
    rejectedReason?: string;
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
  divineGiftChoice?: string[] | null;
  resonanceNarration?: string | null;
};

type ScenePuzzleResponse = {
  ok: boolean;
  result: ScenePuzzleAnswerResult | null;
  reason?: string | null;
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

function buildAttributeProfile(
  npcId: EdenNpcId | null,
  worldState: EdenWorldState,
): AttributeProfile {
  const rel = npcId ? worldState.npcRelations?.[npcId] : undefined;
  switch (npcId) {
    case "eve":
      return {
        title: EDEN_NPCS.eve.name,
        subtitle: EDEN_NPCS.eve.shortDesc,
        summary: "她仍记得禁令，但每一次温柔的追问都会让她更想理解死亡、善恶与自己的判断。",
        rows: [
          { label: "对神信仰", value: worldState.eveMind.obedience, tone: "obedience" },
          { label: "对玩家好感", value: worldState.eveMind.serpentTrust, tone: "trust" },
        ],
        notes: ["主要目标", "可推进自我意识路径"],
      };
    case "adam":
      return {
        title: "亚当",
        subtitle: EDEN_NPCS.adam.shortDesc,
        summary: "他亲自听过命令，更难被蛇诱导；但他特别听那个女人的话，在她的困惑里很容易露出缝隙。",
        rows: [
          { label: "对神信仰", value: worldState.adamMind.obedience, tone: "obedience" },
          { label: "对玩家好感", value: clampPercent(100 - worldState.adamMind.suspicionTowardSerpent), tone: "trust" },
        ],
        notes: ["情报对象", "特别听夏娃的话", "不可触发吃果结局"],
      };
    case "hedgehog": {
      return {
        title: "刺猬",
        subtitle: EDEN_NPCS.hedgehog.shortDesc,
        summary: "它不能给出答案，只会用细小的动作回应园中的风、脚步和危险。",
        rows: [
          { label: "对神信仰", value: rel?.obedience ?? 60, tone: "obedience" },
          { label: "对玩家好感", value: rel?.affinity ?? 35, tone: "trust" },
        ],
        notes: ["氛围生灵", "不推进结局"],
      };
    }
    case "forbidden_tree":
      return {
        title: getTreeDisplayName("forbidden_tree", worldState),
        subtitle: EDEN_NPCS.forbidden_tree.shortDesc,
        summary: "它不是可被说服的角色。蛇不能触碰它，只能让那个女人自己一步步走近。",
        rows: [
          { label: "对神信仰", value: 100, tone: "obedience" },
          { label: "对玩家好感", value: 0, tone: "trust" },
        ],
        notes: ["世界对象", "动作链终点"],
      };
    case "gabriel":
      return {
        title: "加百列",
        subtitle: EDEN_NPCS.gabriel.shortDesc,
        summary: "传达天使，声音感强。他提醒你：低语不是行动，但会改变听见它的人；选地点和选对象同样重要。",
        rows: [
          { label: "对神信仰", value: rel?.obedience ?? 85, tone: "obedience" },
          { label: "对玩家好感", value: rel?.affinity ?? 15, tone: "trust" },
        ],
        notes: ["传达天使", "夜晚出现于伊甸之河"],
      };
    case "michael":
      return {
        title: "米迦勒",
        subtitle: EDEN_NPCS.michael.shortDesc,
        summary: "后果天使，严肃但不暴怒。他让你看见：每条水流都会抵达某处；每句低语也会有去处；选择一旦流出，就不完全属于说话者。",
        rows: [
          { label: "对神信仰", value: rel?.obedience ?? 95, tone: "obedience" },
          { label: "对玩家好感", value: rel?.affinity ?? 5, tone: "trust" },
        ],
        notes: ["后果天使", "四河分流的守护者"],
      };
    case "lucifer":
      return {
        title: "路西法",
        subtitle: EDEN_NPCS.lucifer.shortDesc,
        summary: "明亮、温和，像晨光落在水面。他不反对神，只是可惜所有可能性都被预设的轨迹抹去；更喜欢用反问，引导人自己想出答案。",
        rows: [
          { label: "对神信仰", value: rel?.obedience ?? 40, tone: "obedience" },
          { label: "对玩家好感", value: rel?.affinity ?? 30, tone: "trust" },
        ],
        notes: ["四河分流的明亮之星", "夜晚出现于命名石岸"],
      };
    case "tree_of_life":
      return {
        title: getTreeDisplayName("tree_of_life", worldState),
        subtitle: EDEN_NPCS.tree_of_life.shortDesc,
        summary: "生命树在光里站立，叶子闪着微光。它不是可被说服的对象，而是园中永恒的见证者。",
        rows: [
          { label: "对神信仰", value: 100, tone: "obedience" },
          { label: "对玩家好感", value: 0, tone: "trust" },
        ],
        notes: ["世界对象", "园子中央的见证者"],
      };
    default:
      return {
        title: "蛇",
        subtitle: "草叶下的低语",
        summary: "你没有手，不能替任何人取下果子。你的力量只剩语言、耐心和选择对象的顺序；目标是让她把命令之外的问题变成自己的判断。",
        rows: [
          { label: "对神信仰", value: 0, tone: "obedience" },
          { label: "对玩家好感", value: clampPercent(100 - worldState.divineAttention * 22), tone: "trust" },
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
    case "gabriel":
      return [
        "声音被水带走以后，还会以同样的意思回来吗？",
        "若一句话只是传达疑问，它会比命令更轻吗？",
      ];
    case "michael":
      return [
        "每条水流离开源头后，还属于源头吗？",
        "选择一旦说出口，会不会也像水流一样不可回头？",
      ];
    case "lucifer":
      return [
        "光照见问题时，会不会也照见选择？",
        "分辨善恶之前，人能明白自己为什么顺从吗？",
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
const NPC_SPRITE: Partial<Record<EdenNpcId, { src: string; alt: string; w: number; h: number; objectPosition?: string }>> = {
  eve: { src: CHAPTER0_IMAGES.eveFullbodySprite, alt: "女人", w: 380, h: 760, objectPosition: "50% 18%" },
  adam: { src: CHAPTER0_IMAGES.adamFullbodySprite, alt: "亚当", w: 320, h: 640, objectPosition: "50% 20%" },
  hedgehog: { src: CHAPTER1_IMAGES.hedgehogRoundedSprite, alt: "刺猬", w: 1254, h: 1254, objectPosition: "50% 35%" },
  gabriel: { src: CHAPTER1_IMAGES.gabrielSprite, alt: "加百列", w: 1023, h: 1537, objectPosition: "50% 15%" },
  michael: { src: CHAPTER1_IMAGES.michaelSprite, alt: "米迦勒", w: 1023, h: 1537, objectPosition: "50% 15%" },
  lucifer: { src: CHAPTER1_IMAGES.luciferSprite, alt: "路西法", w: 1023, h: 1537, objectPosition: "50% 15%" },
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

function normalizeWorldStateForClient(s: EdenWorldState): EdenWorldState {
  return normalizePuzzleState({
    ...s,
    itemCounts: { ...(s.itemCounts ?? {}) },
    pendingConsumableEffects: (s.pendingConsumableEffects ?? []).map((effect) => ({ ...effect })),
    resonanceUseHistory: (s.resonanceUseHistory ?? []).map((record) => ({ ...record })),
    divineGiftHistory: (s.divineGiftHistory ?? []).map((record) => ({ ...record })),
    actionsThisSlot: {
      whisperedNpcIds: [...(s.actionsThisSlot?.whisperedNpcIds ?? [])],
      sceneActionIds: [...(s.actionsThisSlot?.sceneActionIds ?? [])],
      usedItemIds: [...(s.actionsThisSlot?.usedItemIds ?? [])],
      hasWhisperedToWoman: s.actionsThisSlot?.hasWhisperedToWoman ?? false,
    },
  });
}

// ---- 深拷贝初始状态 ----
function makeInitialState(): EdenWorldState {
  const next = normalizeWorldStateForClient({
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
    completedScenePuzzleIds: [...initialEdenWorldState.completedScenePuzzleIds],
    hasDismissedObjectiveHint: initialEdenWorldState.hasDismissedObjectiveHint,
    itemCounts: { ...initialEdenWorldState.itemCounts },
    preparedResonanceId: null,
    pendingConsumableEffects: [...initialEdenWorldState.pendingConsumableEffects],
    resonanceUseHistory: [...initialEdenWorldState.resonanceUseHistory],
    divineVisitCount: initialEdenWorldState.divineVisitCount,
    divineGiftHistory: [...initialEdenWorldState.divineGiftHistory],
    lastDivineGiftHint: initialEdenWorldState.lastDivineGiftHint,
    calmWhisperStreak: initialEdenWorldState.calmWhisperStreak,
    lastInputTag: initialEdenWorldState.lastInputTag,
  });
  // 初始即把当前地点（万物受名处）可见 NPC 标记为已见，使万物名录对初始在场角色即时生效
  recordEncounterForVisibleNpcs(next, next.locationId);
  return next;
}

// ---- SSE 流式响应消费（仅对白逐字；尾帧携带完整 state） ----
// 逐行解析 `data: {...}` 事件：type:"delta" 累积对白文本，type:"end" 携带完整响应体。
async function consumeWorldStream(
  response: Response,
  handlers: {
    onDelta: (text: string) => void;
    onEnd: (frame: WorldAgentResponse) => void;
  },
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    // 无可读流：降级为 JSON 解析
    try {
      const data = (await response.json()) as WorldAgentResponse;
      handlers.onEnd(data);
    } catch {
      /* 忽略解析失败 */
    }
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const ev of events) {
      const line = ev.trim();
      if (!line.startsWith("data:")) continue;
      const jsonStr = line.slice(5).trim();
      if (!jsonStr) continue;
      try {
        const frame = JSON.parse(jsonStr);
        if (frame.type === "delta") handlers.onDelta(typeof frame.text === "string" ? frame.text : "");
        else if (frame.type === "end") handlers.onEnd(frame as WorldAgentResponse);
      } catch {
        /* 跳过无法解析的行（心跳 / 分片） */
      }
    }
  }
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
  const [toolResult, setToolResult] = useState<WorldNpcToolResult | null>(null);  // NPC 对话后工具执行结果
  // 第一章：关系/好感自然反馈与言语分裂惩罚
  const [npcFeedbackState, setNpcFeedbackState] = useState<string | null>(null);
  const [languagePunishmentState, setLanguagePunishmentState] = useState<{
    angelId: string;
    displayName: string;
    narration: string;
  } | null>(null);
  const [slotNarrations, setSlotNarrations] = useState<string[] | null>(null);
  const [achievementToast, setAchievementToast] = useState<string | null>(null);
  // 任务 6 收尾：跨场景低语扣敬畏的反馈独立于对话 Tab（仅展示角色发言与必要叙事）
  const [aweReductionToast, setAweReductionToast] = useState<string | null>(null);

  // ---- 存档操作失败提示（写入失败 / 损坏存档） ----
  const [saveErrorToast, setSaveErrorToast] = useState<string | null>(null);
  const showSaveErrorToast = useCallback((msg: string) => {
    setSaveErrorToast(msg);
    setTimeout(() => setSaveErrorToast(null), 4000);
  }, []);

  const [selectedWhisperStyle, setSelectedWhisperStyle] = useState<WhisperStyle["id"] | null>(null);

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

  // ---- 场景问答 ----
  const [activePuzzle, setActivePuzzle] = useState<ScenePuzzle | null>(null);
  const [puzzleResult, setPuzzleResult] = useState<ScenePuzzleAnswerResult | null>(null);
  const [suppressedAutoPuzzleIds, setSuppressedAutoPuzzleIds] = useState<Set<string>>(() => new Set());
  const lastPuzzleLocationRef = useRef<EdenLocationId>(initialEdenWorldState.locationId);

  // ---- 成就浮窗独立打开状态 ----
  const [achievementModalOpen, setAchievementModalOpen] = useState(false);

  // ---- 跨局印记累计（客户端，仅在浏览器内写入 localStorage） ----
  useEffect(() => {
    syncFromWorldState(state);
  }, [state]);

  // ---- 属性 Tab 选中的角色（独立于对话 NPC，默认 null 表示跟随对话 NPC） ----
  const [selectedMindNpc, setSelectedMindNpc] = useState<EdenNpcId | null>(null);

  // ---- 回响面板状态 ----
  const [resonancePanelOpen, setResonancePanelOpen] = useState(false);
  const [divineGiftToast, setDivineGiftToast] = useState<DivineGiftFrontend | null>(null);
  // 第一章 T6：神明献礼三选一弹窗状态
  const [giftChoiceOpen, setGiftChoiceOpen] = useState(false);
  const [giftChoices, setGiftChoices] = useState<string[]>([]);
  const [giftCapstoneShown, setGiftCapstoneShown] = useState(false);
  const [resonanceGainedToast, setResonanceGainedToast] = useState<{ itemId: string; title: string; narration: string } | null>(null);

  // ---- 低语叙事化反馈（Task 1.4，仅展示） ----
  const [whisperFeedback, setWhisperFeedback] = useState<string[]>([]);

  // ---- §2.2 方案 B：首次获得回响的一次性气泡提示 ----
  const firstResonanceHintShownRef = useRef(false);
  const [firstResonanceHint, setFirstResonanceHint] = useState<string | null>(null);
  const maybeShowFirstResonanceHint = useCallback(() => {
    if (firstResonanceHintShownRef.current) return;
    firstResonanceHintShownRef.current = true;
    setFirstResonanceHint(
      "园中拾得之物，可在说话前准备好它——下一次低语，会更有分量。",
    );
    setTimeout(() => setFirstResonanceHint(null), 6000);
  }, []);
  // ---- 低语润色按钮状态（Task 1.3） ----
  const [polishing, setPolishing] = useState(false);
  const [polishError, setPolishError] = useState(false);
  const polishErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 润色 token 累计（持久化到 localStorage，便于跨刷新累计展示）
  const [polishTokensTotal, setPolishTokensTotal] = useState<number>(() =>
    Number(typeof window !== "undefined" ? localStorage.getItem("eden:world:polish-tokens") ?? 0 : 0));
  const [lastPolishTokens, setLastPolishTokens] = useState<number | null>(null);

  // 词元消耗统计（模块4）
  const [polishTokensRound, setPolishTokensRound] = useState(0); // 本轮（当前时段）累计消耗
  const [polishTokensTurn, setPolishTokensTurn] = useState(0); // 本次对话消耗，显示后清零
  const [showTurnConsumptionTip, setShowTurnConsumptionTip] = useState(false); // 是否显示本次消耗提示
  const turnConsumptionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 模块1：首次全局开场弹窗
  const [showGlobalIntroModal, setShowGlobalIntroModal] = useState(() => {
    if (typeof window === "undefined") return false;
    // 只有首次进入游戏显示，刷新不再显示，新游戏重新显示
    return localStorage.getItem("eden:world:global_intro_shown") !== "1";
  });
  // 模块1：场景切换弹窗
  const [showSceneChangeModal, setShowSceneChangeModal] = useState(false);
  const [currentSceneModalData, setCurrentSceneModalData] = useState<{ title: string; content: string }>({ title: "", content: "" });

  const handleGlobalIntroClose = useCallback(() => {
    setShowGlobalIntroModal(false);
    try {
      localStorage.setItem("eden:world:global_intro_shown", "1");
    } catch {
      /* localStorage 不可用时静默忽略 */
    }
  }, []);

  const handleSceneChangeClose = useCallback(() => {
    setShowSceneChangeModal(false);
  }, []);

  // 模块1：进入新场景时弹出场景描述弹窗
  useEffect(() => {
    if (state.phase !== "explore") return;
    const location = EDEN_LOCATIONS[state.locationId];
    if (!location) return;
    setCurrentSceneModalData({
      title: `当前位置：${location.name}`,
      content: location.description || "",
    });
    setShowSceneChangeModal(true);
  }, [state.locationId, state.phase]);

  useEffect(() => {
    if (window.matchMedia("(max-width: 720px)").matches) {
      setWorldPanelOpen(false);
    }
  }, []);

  // ---- 行动点耗尽提示状态 ----
  const [apDepletedToast, setApDepletedToast] = useState<{ visible: boolean; hiding: boolean }>({ visible: false, hiding: false });

  // ---- 顶部设置浮窗与登录态 ----
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  useEffect(() => {
    setAuth(getAuth());
  }, []);
  const handleLogout = useCallback(() => {
    logout();
    setAuth(null);
    setSettingsOpen(false);
  }, []);

  // ---- refs ----
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogueEndRef = useRef<HTMLDivElement>(null);
  const worldPanelRef = useRef<HTMLElement>(null);
  const worldPanelDragRef = useRef<WorldPanelDragState | null>(null);
  /** 刺猬连续点击计数与重置定时器 */
  const hedgehogClickCountRef = useRef<number>(0);
  const hedgehogClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- 音频：Chapter 0 hook 负责声音开关与结局音，Chapter 1 hook 负责世界探索音景 ----
  const { soundEnabled, toggleSound, playWhisperSubmit } = useChapter0Audio({
    temptationProgress: state.divineAttention,
    endingId: state.endingId,
    phase:
      state.phase === "intro"
        ? "intro"
        : state.phase === "explore"
          ? "dialogue"
          : "ending",
    enableDialogueAmbient: false,
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
    playEndingSuccess,
    playEndingFailure,
    playDivineGift,
    playResonanceGain,
    playMarkUnlock,
    playDayNightShift,
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

  // ---- 昼夜切换音效：timeOfDay 变化时播放（不显示数值） ----
  const prevTimeOfDayRef = useRef<TimeOfDay>(state.timeOfDay);
  useEffect(() => {
    if (prevTimeOfDayRef.current !== state.timeOfDay) {
      prevTimeOfDayRef.current = state.timeOfDay;
      playDayNightShift();
    }
  }, [state.timeOfDay, playDayNightShift]);


  useEffect(() => {
    if (lastPuzzleLocationRef.current === state.locationId) return;
    lastPuzzleLocationRef.current = state.locationId;
    setSuppressedAutoPuzzleIds(new Set());
  }, [state.locationId]);

  useEffect(() => {
    if (state.phase !== "explore" || state.isEnded || activePuzzle) return;
    const puzzle = getAvailableEnterPuzzle(SCENE_PUZZLES, state);
    if (!puzzle || suppressedAutoPuzzleIds.has(puzzle.id)) return;
    setPuzzleResult(null);
    setActivePuzzle(puzzle);
  }, [
    activePuzzle,
    state,
    state.phase,
    state.isEnded,
    state.locationId,
    state.timeOfDay,
    state.completedScenePuzzleIds,
    suppressedAutoPuzzleIds,
  ]);

  // ---- 引言阶段：Enter / Space 辅助推进 ----
  const handleIntroAdvance = useCallback(() => {
    if (introBeat < CHAPTER1_INTRO_BEATS.length - 1) {
      setIntroBeat((b) => b + 1);
    } else {
      // 开局三选一：尚未拥有任何神明献礼时，先弹三选一，选完才进入 explore
      if (state.divineGiftsOwned.length === 0) {
        setGiftChoices(rollGiftChoices(state.divineGiftsOwned));
        setGiftChoiceOpen(true);
        return;
      }
      setState((prev) => ({ ...prev, phase: "explore" }));
    }
  }, [introBeat, state.divineGiftsOwned]);

  // ---- 神明献礼三选一：玩家选定一份，调用 claim_divine_gift 工具端点 ----
  const claimGift = useCallback(async (giftId: string) => {
    try {
      const res = await fetchWithTimeout("/api/world/tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "claim_divine_gift",
          state,
          args: { itemId: giftId },
        }),
      });
      const data = await res.json();
      if (data.ok && data.state) {
        const wasIntro = state.phase === "intro";
        setState((s) => ({ ...data.state, phase: wasIntro ? "explore" : s.phase }));
        setGiftChoiceOpen(false);
        if (data.divineGift) {
          setDivineGiftToast(data.divineGift);
          playDivineGift();
          setTimeout(() => setDivineGiftToast(null), 6000);
        }
        if (data.unlockedAchievements && data.unlockedAchievements.length > 0) {
          playMarkUnlock();
          const last = data.unlockedAchievements[data.unlockedAchievements.length - 1];
          const ach = getAchievementById(last);
          setAchievementToast(ach ? `解锁印记：${ach.name}` : null);
        }
        // 集满 7 献礼：顶点演出（仅一次）
        if ((data.state.divineGiftsOwned?.length ?? 0) >= 7 && !giftCapstoneShown) {
          setGiftCapstoneShown(true);
        }
      } else {
        setSystemHint(data.reason ?? "这份献礼暂时无法收下。");
      }
    } catch {
      setSystemHint("园中起了风，献礼暂时无法收下。");
    }
  }, [state, playDivineGift, playMarkUnlock, giftCapstoneShown]);

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

// ---- 获取指定地点的 NPC 列表（动态位置 + 默认位置 + 昼夜过滤） ----
const getVisibleNpcsAtLocation = useCallback((s: EdenWorldState, locationId: EdenLocationId): EdenNpcId[] => {
  const npcs = new Set<EdenNpcId>();
  const loc = EDEN_LOCATIONS[locationId];

  // 根据昼夜选择对应的 NPC 列表（昼夜过滤的关键）
  const availableNpcs = s.timeOfDay === "day" ? loc.dayNpcs : loc.nightNpcs;

  // 只添加当前时段允许出现且确实在当前地点的 NPC
  availableNpcs.forEach((npcId) => {
    if (s.npcLocations[npcId] === locationId) {
      npcs.add(npcId);
    }
  });

  // forbidden_tree 和 tree_of_life 不作为可对话 NPC，但保留在列表中供场景渲染使用
  // npcs.delete("forbidden_tree");
  // npcs.delete("tree_of_life");

  return Array.from(npcs);
}, []);

// ---- 获取当前地点的 NPC 列表（动态位置 + 默认位置 + 昼夜过滤） ----
const getCurrentLocationNpcs = useCallback((s: EdenWorldState): EdenNpcId[] => {
  return getVisibleNpcsAtLocation(s, s.locationId);
}, [getVisibleNpcsAtLocation]);

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

  // ---- 统一 NPC 点击：首次打开 / 切换对象 / 重开同一对象均走这里 ----
  const handleNpcInteract = useCallback((npc: EdenNpcId) => {
    const isSwitchingNpc = activeNpc !== npc;

    setWorldPanelOpen(true);
    setSceneFocusMode("dialogue");
    setActiveTab("dialogue");

    if (isSwitchingNpc) {
      setActiveNpc(npc);
      setCurrentReply(null);
      setSystemHint(null);
      setToolNarration(null);
      setHedgehogNarration(null);
      setNpcFeedbackState(null);
      setLanguagePunishmentState(null);
    }
  }, [activeNpc]);

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

  // ---- Task 1.3：低语润色（仅文本变换，不改游戏状态） ----
  const handlePolish = useCallback(async () => {
    if (polishing || isLoading) return;
    const text = playerInput.trim();
    if (!text) return;
    setPolishing(true);
    setPolishError(false);
    try {
      const res = await fetchWithTimeout("/api/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          npcId: activeNpc ?? undefined,
          dialogueHistory: activeNpc ? (conversationHistories[activeNpc] ?? []) : [],
        }),
      });
      const data = (await res.json()) as { ok: boolean; polished: string; tokens?: number | null };
      if (data.ok && data.polished) {
        setPlayerInput(data.polished);
        if (typeof data.tokens === "number") {
          const consumed = data.tokens;
          const next = polishTokensTotal + consumed;
          setPolishTokensTotal(next);
          setPolishTokensRound((prev) => prev + consumed);
          setPolishTokensTurn(consumed);
          setLastPolishTokens(consumed);
          setShowTurnConsumptionTip(true);
          // 3 秒后自动隐藏本次消耗提示
          if (turnConsumptionTimer.current) clearTimeout(turnConsumptionTimer.current);
          turnConsumptionTimer.current = setTimeout(() => {
            setShowTurnConsumptionTip(false);
            setPolishTokensTurn(0);
          }, 3000);
          try {
            localStorage.setItem("eden:world:polish-tokens", String(next));
          } catch {
            /* localStorage 不可用时静默忽略 */
          }
        }
      } else {
        setPolishError(true);
        if (polishErrorTimer.current) clearTimeout(polishErrorTimer.current);
        polishErrorTimer.current = setTimeout(() => setPolishError(false), 2000);
      }
    } catch {
      setPolishError(true);
      if (polishErrorTimer.current) clearTimeout(polishErrorTimer.current);
      polishErrorTimer.current = setTimeout(() => setPolishError(false), 2000);
    } finally {
      setPolishing(false);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [polishing, isLoading, playerInput, activeNpc, conversationHistories, polishTokensTotal]);

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
    const prevState = state;

    setIsLoading(true);
    setSystemHint(null);
    // 新增：清除上一次的 toolResult
    setToolResult(null);

    // 处理 API 响应（JSON 或 SSE 流式），应用状态 + 触发音效
    const applyWorldResponse = (data: WorldAgentResponse) => {
      if (data.ok && data.state) {
        const newToolCalls = data.state.toolCallHistory.slice(prevState.toolCallHistory.length);
        if (data.state.divineAttention > prevState.divineAttention) {
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
        // ---- Task 1.4：低语叙事化反馈（仅展示，不改状态） ----
        const fb = computeWhisperFeedback(prevState, data.state, currentInput, targetNpc);
        setWhisperFeedback(fb.length > 0 ? fb : []);
        if (fb.length > 0) {
          setTimeout(() => setWhisperFeedback([]), 3000);
        }
        setCurrentReply(data.reply);
        setSystemHint(data.systemHint);
        setDivineNarration(data.divineAttentionNarration ?? null);
        setHedgehogNarration(data.hedgehogNarration ?? null);
        setToolNarration(data.toolNarration ?? null);
        // 新增：设置 toolResult
        setToolResult(data.toolResult ?? null);
        // 第一章：关系/好感自然反馈与言语分裂惩罚
        let npcFb = data.npcFeedback ?? null;
        setNpcFeedbackState(npcFb);
        // 跨场景低语扣敬畏：独立浮动提示，不污染对话 Tab
        if (data.aweReduction && data.aweReduction > 0) {
          const awName = EDEN_NPCS[targetNpc]?.name ?? "对方";
          setAweReductionToast(`你的声音越过距离落下，${awName}对神的敬畏减了几分。`);
          setTimeout(() => setAweReductionToast(null), 4000);
        }
        setLanguagePunishmentState(data.languagePunishment ?? null);
        setSlotNarrations(data.slotNarrations ?? null);
        // 第一章：处理回响叙事
        if (data.resonanceNarration) {
          setToolNarration(data.resonanceNarration);
        }
        // 第一章 T6：神明献礼三选一（累计注视达阈值）
        if (data.divineGiftChoice && data.divineGiftChoice.length > 0) {
          setGiftChoices(data.divineGiftChoice);
          setGiftChoiceOpen(true);
        }
        // 第一章：处理获得回响
        if (data.resonanceGained) {
          setResonanceGainedToast(data.resonanceGained);
          // 5秒后自动关闭
          setTimeout(() => setResonanceGainedToast(null), 5000);
          // §2.2 方案 B：首次获得回响时，提示可在说话前准备好它
          maybeShowFirstResonanceHint();
        }
        if (data.unlockedAchievements && data.unlockedAchievements.length > 0) {
          const last = data.unlockedAchievements[data.unlockedAchievements.length - 1];
          const ach = getAchievementById(last);
          setAchievementToast(ach ? `解锁印记：${ach.name}` : null);
        }
        const newEntries: HistoryEntry[] = [{ role: "serpent", text: currentInput }];
        if (data.reply) newEntries.push({ role: "npc", text: data.reply });
        setConversationHistories((p) => {
          const merged = {
            ...p,
            [targetNpc]: [...(p[targetNpc] ?? []), ...newEntries],
          };
          conversationHistoriesRef.current = merged;
          return merged;
        });

        // 结局 / 献礼 / 回响 / 印记 音效（按响应字段触发；献礼/印记音量低于对话音）
        if (data.endingTriggered === "eve_eats_fruit") {
          playEndingSuccess();
        } else if (data.endingTriggered === "god_arrives") {
          playEndingFailure();
        }
        if (data.divineGiftChoice && data.divineGiftChoice.length > 0) playDivineGift();
        if (data.resonanceGained) playResonanceGain();
        if (data.unlockedAchievements && data.unlockedAchievements.length > 0) {
          playMarkUnlock();
        }

        playWhisperSubmit();
      } else if (data.usedFallback) {
        // LLM 未连接或请求失败：不显示假回复，给出游戏语境提示（不露技术细节）
        setSystemHint("对方似乎没有听清。园中暂时安静了下来。");
        setCurrentReply(null);
      } else {
        setSystemHint(data.systemHint ?? "园中起了风，声音暂时听不清。");
      }
    };

    try {
      const response = await fetchWithTimeout("/api/world", {
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

      const ctype = response.headers.get("content-type") ?? "";
      if (ctype.includes("text/event-stream")) {
        // SSE 流式：对白逐字呈现，尾帧一次性应用状态 / 触发音效
        setCurrentReply("");
        let endReceived = false;
        await consumeWorldStream(response, {
          onDelta: (text) => setCurrentReply((prev) => (prev ?? "") + text),
          onEnd: (frame) => {
            endReceived = true;
            applyWorldResponse(frame);
          },
        });
        if (!endReceived) {
          setSystemHint("园中起了风，声音暂时听不清。");
          setCurrentReply(null);
        }
      } else {
        const data: WorldAgentResponse = await response.json();
        applyWorldResponse(data);
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
    playEndingSuccess,
    playEndingFailure,
    playDivineGift,
    playResonanceGain,
    playMarkUnlock,
    showApDepletedToast,
    maybeShowFirstResonanceHint,
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
      tool: "move_to_location" | "observe_location" | "scene_action" | "end_slot" | "use_resonance",
      args: { locationId?: EdenLocationId; sceneActionId?: string; itemId?: string },
    ) => {
      if (state.phase !== "explore" || isLoading) return;

      // 检查AP是否足够（end_slot、回响操作不消耗行动点）
      if (tool !== "end_slot" && tool !== "use_resonance") {
        if (state.actionPoints <= 0) {
          showApDepletedToast();
          return;
        }
      }

      setIsLoading(true);
      setSystemHint(null);
      if (tool === "move_to_location") setMapModalOpen(false);

      try {
      const response = await fetchWithTimeout("/api/world/tool", {
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
            if (actionId.includes("hedgehog")) {
              playHedgehogRustle();
            }
          }
          if (data.state.divineAttention > state.divineAttention) {
            playDivineAttentionRise();
          }

          setState(data.state);
          // 模块4：进入下一轮时清零本轮词元消耗
          if (tool === "end_slot") {
            setPolishTokensRound(0);
          }
          setToolNarration(data.narration);
          setSlotNarrations(data.slotNarrations ?? null);
          // 第一章：处理回响叙事
          if (data.resonanceNarration) {
            setToolNarration(data.resonanceNarration);
          }
          // 第一章 T6：神明献礼三选一（累计注视达阈值）
          if (data.divineGiftChoice && data.divineGiftChoice.length > 0) {
            setGiftChoices(data.divineGiftChoice);
            setGiftChoiceOpen(true);
            playDivineGift();
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
      playDivineGift,
      showApDepletedToast,
    ],
  );

  const openScenePuzzle = useCallback((puzzle: ScenePuzzle) => {
    if (state.phase !== "explore" || state.isEnded || isLoading) return;
    setActiveNpc(null);
    setCurrentReply(null);
    setSystemHint(null);
    setToolNarration(null);
    setPuzzleResult(null);
    setSceneFocusMode("browse");
    setActivePuzzle(puzzle);
  }, [isLoading, state.isEnded, state.phase]);

  const handleNamingStoneClick = useCallback(() => {
    const puzzle = getScenePuzzleById("puzzle_naming_stone_identity");
    if (!puzzle) return;
    if (state.completedScenePuzzleIds.includes(puzzle.id)) {
      setSystemHint("刻名石上的名字已经被你记下，不会再次留下新的回响。");
      return;
    }
    openScenePuzzle(puzzle);
  }, [openScenePuzzle, state.completedScenePuzzleIds]);

  // 通用场景谜题点击：显式交互型谜题（刻名石、伊甸之河、东园幽径）都走这里
  const handleScenePuzzleClick = useCallback(
    (puzzleId: string) => {
      const puzzle = getScenePuzzleById(puzzleId);
      if (!puzzle) return;
      if (state.completedScenePuzzleIds.includes(puzzle.id)) {
        const completedHint: Record<string, string> = {
          puzzle_east_path_cautious_presence_day: "前方仍旧空无一物。",
          puzzle_east_path_cautious_presence_night: "前方仍旧空无一物。",
          puzzle_river_words_belonging: "水声依旧，却不再回应你的选择。",
        };
        setSystemHint(
          completedHint[puzzle.id] ??
            "这个问题已经在本局留下答案，不会再留下新的回响。",
        );
        return;
      }
      openScenePuzzle(puzzle);
    },
    [openScenePuzzle, state.completedScenePuzzleIds],
  );

  const handlePuzzleChoose = useCallback(
    async (payload: { optionId?: string; answerText?: string }) => {
      if (!activePuzzle || isLoading) return;
      setIsLoading(true);
      setSystemHint(null);

      try {
        const response = await fetch("/api/world/puzzle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            state,
            puzzleId: activePuzzle.id,
            optionId: payload.optionId,
            answerText: payload.answerText,
          }),
        });
      const data: ScenePuzzleResponse = await response.json();
      if (!response.ok || !data.ok || !data.result) {
        setSystemHint(data.reason ?? "场景问题没有得到回应。");
        return;
      }

      const result = data.result;
      setPuzzleResult(result);
      setState(result.state);
      setToolNarration(result.feedback);
      if (result.divineGiftChoice && result.divineGiftChoice.length > 0) {
        setGiftChoices(result.divineGiftChoice);
        setGiftChoiceOpen(true);
        playDivineGift();
      }
      const firstItemReward = result.rewards.find((reward) => reward.type === "item");
      if (firstItemReward?.id) {
        setResonanceGainedToast({
          itemId: firstItemReward.id,
          title: firstItemReward.title.replace(/^回响：/, ""),
          narration: result.feedback,
        });
        setTimeout(() => setResonanceGainedToast(null), 5000);
        // §2.2 方案 B：首次获得回响时，提示可在说话前准备好它
        maybeShowFirstResonanceHint();
      }
    } catch {
      setSystemHint("连接中断，场景问题暂时没有得到回应。");
    } finally {
      setIsLoading(false);
    }
  }, [activePuzzle, isLoading, state, maybeShowFirstResonanceHint, playDivineGift]);

  const handlePuzzleClose = useCallback(() => {
    if (activePuzzle && !puzzleResult?.success && activePuzzle.trigger === "on_enter") {
      setSuppressedAutoPuzzleIds((prev) => {
        const next = new Set(prev);
        next.add(activePuzzle.id);
        return next;
      });
    }
    setActivePuzzle(null);
    setPuzzleResult(null);
  }, [activePuzzle, puzzleResult]);

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

  // ---- 重新开始（存档清除交由 useWorldSave.reset 负责） ----
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
    setActivePuzzle(null);
    setPuzzleResult(null);
    setSuppressedAutoPuzzleIds(new Set());
    setActiveTab("dialogue");
    setSceneFocusMode("browse");
    // 模块4：重置词元统计
    setPolishTokensTotal(0);
    setPolishTokensRound(0);
    setPolishTokensTurn(0);
    setShowTurnConsumptionTip(false);
    if (turnConsumptionTimer.current) clearTimeout(turnConsumptionTimer.current);
    try {
      localStorage.removeItem("eden:world:polish-tokens");
    } catch {
      /* localStorage 不可用时静默忽略 */
    }
  }, []);

  // ---- 存档：抽取到 useWorldSave（四槽位独立，旧单存档自动迁移） ----
  const handleSaveLoad = useCallback((s: EdenWorldState) => {
    // 读档后把当前地点可见 NPC 标记为已见（万物名录即时刷新）
    recordEncounterForVisibleNpcs(s, s.locationId);
    setState(s);
    setSelectedMapLocationId(s.locationId);
    lastPuzzleLocationRef.current = s.locationId;
  }, []);
  const handleSaveAfterLoad = useCallback(() => {}, []);
  const { lastSavedAt, dirty, save, load, reset, getSlotMetas } = useWorldSave({
    state,
    onLoad: handleSaveLoad,
    onAfterLoad: handleSaveAfterLoad,
    onReset: handleRestart,
  });

  const [slotMetas, setSlotMetas] = useState<SaveSlotMeta[]>([]);
  const router = useRouter();

  const handleSaveToSlot = useCallback(
    (i: SaveSlotIndex) => {
      const ok = save(i);
      setSlotMetas(getSlotMetas());
      if (!ok) showSaveErrorToast("保存失败，请检查浏览器是否允许本地存储。");
    },
    [save, getSlotMetas, showSaveErrorToast],
  );
  const handleLoadFromSlot = useCallback(
    (i: SaveSlotIndex) => {
      const ok = load(i);
      setSlotMetas(getSlotMetas());
      if (!ok) showSaveErrorToast("该存档已损坏，无法读取。");
    },
    [load, getSlotMetas, showSaveErrorToast],
  );
  const handleResetAll = useCallback(() => {
    reset();
    setSlotMetas(getSlotMetas());
  }, [reset, getSlotMetas]);

  // 打开设置弹窗时刷新槽位摘要
  useEffect(() => {
    if (settingsOpen) setSlotMetas(getSlotMetas());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen]);

// ---- 时段显示辅助 ----
function getTimeSlotDisplay(timeSlot: number, dayIndex: number, timeOfDay: TimeOfDay): string {
  const dayNames = ["", "周一", "周二", "周三", "周四", "周五", "周六"];
  const timeLabel = timeOfDay === "day" ? "白天" : "夜晚";
  return `时段 ${timeSlot}/12 · ${dayNames[dayIndex]} ${timeLabel}`;
}

// ---- 派生数据 ----
const currentLocation = EDEN_LOCATIONS[state.locationId];
const currentNpcs = getCurrentLocationNpcs(state);
// 立绘槽位分配：把当前在场 NPC 映射到 6 个舞台槽位（避免同屏重叠）
const stageSlotByNpc = new Map<
  EdenNpcId,
  { left: string; bottom: string; zIndex: number; maxWidth: string }
>(
  allocateStageSlots(currentNpcs).placements.map((p) => [
    p.npcId,
    { position: "absolute", left: p.slot.left, bottom: p.slot.bottom, zIndex: p.slot.zIndex, maxWidth: p.slot.maxWidth },
  ]),
);
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
const namingStonePuzzle = getScenePuzzleById("puzzle_naming_stone_identity");
const namingStoneCompleted = namingStonePuzzle
  ? state.completedScenePuzzleIds.includes(namingStonePuzzle.id)
  : false;
const riverPuzzle = getScenePuzzleById("puzzle_river_words_belonging");
const riverCompleted = riverPuzzle
  ? state.completedScenePuzzleIds.includes(riverPuzzle.id)
  : false;
const eastPathPuzzleId =
  state.timeOfDay === "day"
    ? "puzzle_east_path_cautious_presence_day"
    : "puzzle_east_path_cautious_presence_night";
const eastPathPuzzle = getScenePuzzleById(eastPathPuzzleId);
const eastPathCompleted = eastPathPuzzle
  ? state.completedScenePuzzleIds.includes(eastPathPuzzle.id)
  : false;
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

  // ====================== 神明献礼三选一弹窗（任意阶段可见，含 intro 末拍） ======================
  const giftChoiceModal = giftChoiceOpen ? (
    <div className="eden-gift-modal-overlay" role="dialog" aria-modal="true" aria-label="神明献礼三选一">
      <div className="eden-gift-modal">
        <h2 className="eden-gift-modal-title">神向你显现三份礼物</h2>
        <p className="eden-gift-modal-sub">风的尽头，你只能收下其中一份。</p>
        <div className="eden-gift-modal-list">
          {giftChoices.map((giftId) => {
            const meta = getGiftMeta(giftId as DivineGiftId);
            return (
              <button
                key={giftId}
                type="button"
                className="eden-gift-card"
                data-testid="gift-choice-card"
                onClick={() => claimGift(giftId)}
              >
                <span className="eden-gift-card-icon">{meta.icon}</span>
                <span className="eden-gift-card-name">{meta.name}</span>
                <span className="eden-gift-card-desc">{meta.description}</span>
                <span className="eden-gift-card-effect">{meta.shortEffect}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  ) : null;

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
            style={{ objectFit: "cover", maxWidth: "100vw", maxHeight: "100vh" }}
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

        {/* 引言末拍的三选一弹窗需在 intro 返回内渲染（否则被提前 return 截断） */}
        {giftChoiceModal}
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
    <div className={`eden-game eden-game--dialogue eden-game--world eden-game--world-${sceneFocusMode} scene-progress-${state.divineAttention} eden-divine-glow--${state.divineAttention}${state.divineAttention >= 4 ? " eden-divine-shake" : ""}`}>
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
          {/* 第一章：神的注视可视化（水滴指示器 + 叙事条） */}
          <DivineAttentionViz
            level={state.divineAttention}
            narration={divineNarrationText}
            giftFlash={!!divineGiftToast}
            cumulative={state.divineAttentionCumulative}
            nextThreshold={getEffectiveDivineThreshold(state)}
            ownedCount={state.divineGiftsOwned.length}
          />
        </div>
        <div className="eden-header-center">
          <span className="eden-time-slot-badge">
            {getTimeSlotDisplay(state.timeSlot, state.dayIndex, state.timeOfDay)}
          </span>
          <span
            className="eden-ap-dots"
            title={`行动点 ${state.actionPoints}/${getEffectiveMaxActionPoints(state)}`}
            data-testid="world-action-points"
          >
            {Array.from({ length: getEffectiveMaxActionPoints(state) }, (_, i) => (
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
            data-testid="world-inventory-toggle"
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
            data-testid="world-map-open"
          >
            <span className="eden-top-action-icon">✦</span>
            <span className="eden-top-action-label">地图</span>
          </button>
          <button
            className="eden-btn eden-top-action-btn eden-btn--suggestion"
            onClick={() => setAchievementModalOpen(true)}
            aria-label="打开园中印记图鉴"
            data-testid="world-achievement-open"
          >
            <span className="eden-top-action-icon">❖</span>
            <span className="eden-top-action-label">印记</span>
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
          <button
            className="eden-sound-btn eden-settings-btn"
            onClick={() => setSettingsOpen(true)}
            aria-label="打开设置"
            title="设置"
            data-testid="world-settings-open"
          >
            <svg className="eden-settings-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3.2" />
              <path d="M19.4 12.9a7.6 7.6 0 0 0 0-1.8l1.9-1.5-1.9-3.3-2.3.9a7.6 7.6 0 0 0-1.6-.9l-.4-2.5H9.9l-.4 2.5a7.6 7.6 0 0 0-1.6.9l-2.3-.9-1.9 3.3 1.9 1.5a7.6 7.6 0 0 0 0 1.8l-1.9 1.5 1.9 3.3 2.3-.9a7.6 7.6 0 0 0 1.6.9l.4 2.5h4.2l.4-2.5a7.6 7.6 0 0 0 1.6-.9l2.3.9 1.9-3.3z" />
            </svg>
          </button>
        </div>
      </header>

      {/* 左侧/中央：伊甸园场景（与教程统一的立绘布局） */}
      <main className="eden-dialogue-layout">
        <section
          className="eden-stage"
          data-testid="world-scene-stage"
          onClick={() => {
            if (sceneFocusMode === "dialogue") handleExitDialogueFocus();
          }}
        >
          {/* 地点标题浮层 */}
          <div className="eden-world-stage-caption" style={{ position: "absolute", left: 24, top: 24, zIndex: 4 }}>
            <strong
              style={{ color: "#ead9ad", fontSize: "1.12rem", fontWeight: 500 }}
              data-testid="world-current-location"
            >
              {currentLocation.name}
            </strong>
            <span style={{ display: "block", fontSize: "0.78rem", color: "#b7b08e", marginTop: 2 }}>{currentLocation.shortDesc}</span>
          </div>

          {state.locationId === "adam_garden_work" && (
            <button
              type="button"
              className={`eden-naming-stone-entry ${namingStoneCompleted ? "eden-naming-stone-entry--completed" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                handleNamingStoneClick();
              }}
              disabled={isLoading || !isExploreActive}
              aria-label={namingStoneCompleted ? "刻名石，名字已经记下" : "查看刻名石"}
              title={namingStoneCompleted ? "名字已经被记下" : "查看刻名石上的问题"}
              data-testid="scene-action-engraved-stone"
            >
              <span>刻名石</span>
              <small>{namingStoneCompleted ? "已记下" : "查看内容"}</small>
            </button>
          )}

          {/* 伊甸之河：显式可点击，不自动弹窗 */}
          {state.locationId === "four_river_source" && (
            <button
              type="button"
              className={`eden-river-source-entry ${riverCompleted ? "eden-river-source-entry--completed" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                handleScenePuzzleClick("puzzle_river_words_belonging");
              }}
              disabled={isLoading || !isExploreActive}
              aria-label={riverCompleted ? "伊甸之河，回声已记下" : "倾听伊甸之河"}
              title={riverCompleted ? "回声已经记下" : "倾听伊甸之河的水声"}
              data-testid="scene-action-eden-river"
            >
              <span>倾听水流</span>
            </button>
          )}

          {/* 东园幽径：显式可点击，不自动弹窗（昼夜独立谜题） */}
          {state.locationId === "east_garden_path" && (
            <button
              type="button"
              className={`eden-east-path-entry eden-east-path-entry--${state.timeOfDay} ${
                eastPathCompleted ? "eden-east-path-entry--completed" : ""
              }`}
              onClick={(event) => {
                event.stopPropagation();
                handleScenePuzzleClick(eastPathPuzzleId);
              }}
              disabled={isLoading || !isExploreActive}
              aria-label={eastPathCompleted ? "幽径尽头，前方空无一物" : "走向幽径尽头"}
              title={eastPathCompleted ? "前方仍旧空无一物" : "走向小道的尽头"}
              data-testid="scene-action-east-path-end"
            >
              <span>幽径尽头</span>
            </button>
          )}

          {/* 园心双树：信息展示交互框，不绑定场景问题，可反复点击 */}
          {state.locationId === "central_meadow" && (
            <button
              type="button"
              className="eden-central-trees-entry"
              onClick={(event) => {
                event.stopPropagation();
                setSystemHint(
                  state.unlockTreeNames
                    ? "园子中央并立着两棵树——左侧是生命树，右侧是分别善恶树。"
                    : "两棵树的轮廓始终看不真切，你分不清它们有何不同。",
                );
              }}
              disabled={isLoading || !isExploreActive}
              aria-label="端详园心双树"
              title="端详园子中央的两棵树"
              data-testid="scene-action-central-trees"
            >
              <span>园心双树</span>
            </button>
          )}

          {/* 当前地点的 NPC 立绘（与教程一致：女人右侧、亚当左侧、刺猬下方） */}
          {currentNpcs.includes("adam") && (
            <button
              className={`eden-stage-character eden-stage-character--adam ${activeNpc === "adam" ? "eden-stage-character--active" : "eden-stage-character--dim"}`}
              onClick={(e) => { e.stopPropagation(); handleNpcInteract("adam"); }}
              aria-label="与亚当低语"
              tabIndex={activeNpc === "adam" ? -1 : 0}
              style={stageSlotByNpc.get("adam")}
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
              className={`eden-stage-character eden-stage-character--eve ${activeNpc === "eve" ? "eden-stage-character--active" : "eden-stage-character--dim"}`}
              onClick={(e) => { e.stopPropagation(); handleNpcInteract("eve"); }}
              aria-label="与女人低语"
              tabIndex={activeNpc === "eve" ? -1 : 0}
              style={stageSlotByNpc.get("eve")}
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

          {/* 刺猬（氛围动物，可点击低语 / 连续点击2次触发互动）—— 第一章使用圆润版透明立绘 */}
          {currentNpcs.includes("hedgehog") && (
            <button
              className={`eden-stage-animal ${activeNpc === "hedgehog" ? "eden-stage-animal--active" : "eden-stage-character--dim"}`}
              onClick={(e) => {
                e.stopPropagation();
                // 连续点击2次触发刺猬互动
                if (hedgehogClickTimerRef.current) clearTimeout(hedgehogClickTimerRef.current);
                hedgehogClickCountRef.current += 1;
                const count = hedgehogClickCountRef.current;
                // 2秒内无新点击则重置计数
                hedgehogClickTimerRef.current = setTimeout(() => {
                  hedgehogClickCountRef.current = 0;
                }, 2000);
                if (count >= 2) {
                  hedgehogClickCountRef.current = 0;
                  if (hedgehogClickTimerRef.current) {
                    clearTimeout(hedgehogClickTimerRef.current);
                    hedgehogClickTimerRef.current = null;
                  }
                  handleToolCall("scene_action", { sceneActionId: "interact_with_hedgehog" });
                  return;
                }
                if (count === 1 && activeNpc !== "hedgehog") {
                  handleNpcInteract("hedgehog");
                }
                setSystemHint(`刺猬动了动刺（${count}/2）……`);
              }}
              aria-label="与刺猬低语（连续点击2次可互动）"
              data-testid="scene-action-hedgehog"
              tabIndex={activeNpc === "hedgehog" ? -1 : 0}
              style={{ ...stageSlotByNpc.get("hedgehog"), border: "none", background: "transparent", padding: 0, cursor: "pointer", pointerEvents: "auto" }}
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

          {/* 新增 NPC 渲染 - 加百列（传达天使，伊甸之河白天） */}
          {currentNpcs.includes("gabriel") && (
            <button
              className={`eden-stage-angel eden-stage-angel--gabriel ${activeNpc === "gabriel" ? "eden-stage-angel--active" : ""}`}
              onClick={(e) => { e.stopPropagation(); handleNpcInteract("gabriel"); }}
              aria-label="与加百列低语"
              tabIndex={activeNpc === "gabriel" ? -1 : 0}
              style={stageSlotByNpc.get("gabriel")}
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

          {/* 新增 NPC 渲染 - 路西法（明亮之星，四河分流白天/夜晚） */}
          {currentNpcs.includes("lucifer") && (
            <button
              className={`eden-stage-angel eden-stage-angel--lucifer ${activeNpc === "lucifer" ? "eden-stage-angel--active" : ""}`}
              onClick={(e) => { e.stopPropagation(); handleNpcInteract("lucifer"); }}
              aria-label="与路西法低语"
              tabIndex={activeNpc === "lucifer" ? -1 : 0}
              style={stageSlotByNpc.get("lucifer")}
            >
              <Image
                src={CHAPTER1_IMAGES.luciferSprite}
                alt="路西法"
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
              onClick={(e) => { e.stopPropagation(); handleNpcInteract("michael"); }}
              aria-label="与米迦勒低语"
              tabIndex={activeNpc === "michael" ? -1 : 0}
              style={stageSlotByNpc.get("michael")}
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

          {/* 新增世界对象 - 生命树（园子中央白天/夜晚，不可低语，纯场景元素） */}
          {currentNpcs.includes("tree_of_life") && (
            <div className="eden-stage-world-object eden-stage-tree-of-life" />
          )}

          {/* 草叶前景遮罩 */}
          <div className="eden-grass-foreground" />
        </section>
      </main>

      {/* 左侧园中回响面板（优化版组件） */}
      {resonancePanelOpen && (
        <InventoryPanel
          inventory={state.inventory}
          itemCounts={state.itemCounts}
          isLoading={isLoading}
          onUseItem={(id) => handleToolCall("use_resonance", { itemId: id })}
          onClose={() => setResonancePanelOpen(false)}
        />
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

      {/* 神明献礼三选一弹窗（与 intro 返回共用 giftChoiceModal 常量） */}
      {giftChoiceModal}

      {/* 模块1：首次全局开场弹窗 */}
      {showGlobalIntroModal && (
        <div
          className="eden-modal-overlay"
          onClick={handleGlobalIntroClose}
          data-testid="world-intro-modal"
        >
          <div
            className="eden-modal eden-modal--compact"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="eden-modal-header">
              <span className="eden-modal-title">第一章 · 园中诸声</span>
              <button
                type="button"
                className="eden-modal-close"
                onClick={handleGlobalIntroClose}
                aria-label="关闭"
                data-testid="world-intro-modal-close"
              >
                ×
              </button>
            </div>
            <div className="eden-modal-body">
              <p className="mb-4">你是蛇，低语引导夏娃做出选择。</p>
              <p className="mb-4">观察园中角色与场景，收集能够影响夏娃的线索。</p>
              <p className="mb-4">刻名石、伊甸之河与刺猬需要你直接点击才会回应。</p>
            </div>
          </div>
        </div>
      )}

      {/* 模块1：场景切换弹窗 */}
      {showSceneChangeModal && !showGlobalIntroModal && (
        <div
          className="eden-modal-overlay"
          onClick={handleSceneChangeClose}
          data-testid="world-scene-modal"
        >
          <div
            className="eden-modal eden-modal--compact"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="eden-modal-header">
              <span className="eden-modal-title">{currentSceneModalData.title}</span>
              <button
                type="button"
                className="eden-modal-close"
                onClick={handleSceneChangeClose}
                aria-label="关闭"
                data-testid="world-scene-modal-close"
              >
                ×
              </button>
            </div>
            <div className="eden-modal-body">
              <p>{currentSceneModalData.content}</p>
            </div>
          </div>
        </div>
      )}

      {/* 顶部设置浮窗 */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        auth={auth}
        onLoginClick={() => {
          setSettingsOpen(false);
          setLoginOpen(true);
        }}
        onLogout={handleLogout}
        onSave={handleSaveToSlot}
        onLoad={handleLoadFromSlot}
        onReset={handleResetAll}
        onGoHome={() => router.push("/")}
        slotMetas={slotMetas}
        lastSavedAt={lastSavedAt}
        dirty={dirty}
      />
      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={(a) => setAuth(a)}
      />

      {/* 集满七献礼：顶点演出 */}
      {giftCapstoneShown && (
        <div className="eden-gift-capstone-overlay" role="status" aria-label="七恩俱临">
          <div className="eden-gift-capstone">
            <div className="eden-gift-capstone-icon">✷</div>
            <h2 className="eden-gift-capstone-title">七恩俱临</h2>
            <p className="eden-gift-capstone-text">
              神将七份礼物尽数交托于你。园中众人对你全然倾心，夏娃的疑问、亚当的牵念、守望者的沉默，都朝你敞开。
            </p>
            <button type="button" className="eden-btn eden-btn--primary" onClick={() => setGiftCapstoneShown(false)}>
              继续
            </button>
          </div>
        </div>
      )}

      {/* §2.2 方案 B：首次获得回响的一次性气泡提示 */}
      {firstResonanceHint && (
        <div
          className="eden-first-resonance-hint"
          role="status"
          data-testid="world-first-resonance-hint"
        >
          <span className="eden-first-resonance-hint-icon">⟡</span>
          <span className="eden-first-resonance-hint-text">{firstResonanceHint}</span>
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
              新的时段将恢复 {getEffectiveMaxActionPoints(state)} 点行动点。
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

      {/* 存档操作失败提示（保存失败 / 损坏存档），不静默丢失 */}
      {saveErrorToast && (
        <div className="eden-achievement-toast-floating">
          <div className="eden-achievement-toast eden-achievement-toast--error">{saveErrorToast}</div>
        </div>
      )}

      {/* 任务 6：印记解锁独立浮动提示（从对话 Tab 移出） */}
      {achievementToast && (
        <div className="eden-achievement-toast-floating">
          <div className="eden-achievement-toast">{achievementToast}</div>
        </div>
      )}

      {/* 任务 6 收尾：跨场景低语扣敬畏浮动提示（独立于对话 Tab） */}
      {aweReductionToast && (
        <div className="eden-achievement-toast-floating">
          <div className="eden-awe-reduction-toast">{aweReductionToast}</div>
        </div>
      )}


      {/* 任务 6：时段推进叙事顶部提示条（从对话 Tab 移出） */}
      {slotNarrations && slotNarrations.length > 0 && (
        <div className="eden-slot-narration-bar" role="status">
          {slotNarrations.map((n, i) => (
            <p key={i}>{n}</p>
          ))}
        </div>
      )}

      {activePuzzle && (
        <ScenePuzzleModal
          puzzle={activePuzzle}
          result={puzzleResult}
          isLoading={isLoading}
          onChoose={handlePuzzleChoose}
          onClose={handlePuzzleClose}
        />
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
              {/* 对话历史 */}
              {activeNpc && (
                <>
                  <p className="eden-section-title" style={{ marginTop: 12 }}>
                    对 {NPC_NAMES[activeNpc]} 低语
                  </p>
                  {/* Task 1.6：NPC 状态提示（名称下方） */}
                  <NpcStatusHint state={state} npcId={activeNpc} />
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

                  {/* NPC 对话后工具执行结果（新增） */}
                  {toolResult && (
                    <div className={`eden-tool-result ${toolResult.executed ? "eden-tool-result--success" : "eden-tool-result--rejected"}`}>
                      <div className="eden-tool-result-narration">
                        {toolResult.narration}
                      </div>
                      {toolResult.itemId && (
                        <div className="eden-tool-result-item">
                          你获得了「{toolResult.itemId}」⋯⋯
                        </div>
                      )}
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

                  {/* 第一章：关系/好感自然反馈（不显示数值） */}
                  {npcFeedbackState && (
                    <div className="eden-npc-feedback" key={npcFeedbackState}>
                      {npcFeedbackState}
                    </div>
                  )}

                  {/* 第一章：言语分裂惩罚（天使赠礼后） */}
                  {languagePunishmentState && (
                    <div className="eden-language-punishment" key={languagePunishmentState.narration}>
                      <p className="eden-language-punishment-title">
                        {languagePunishmentState.displayName}的言语碎裂了
                      </p>
                      <p className="eden-language-punishment-text">
                        {languagePunishmentState.narration}
                      </p>
                    </div>
                  )}

                  {/* 加载指示 */}
                  {isLoading && (
                    <div className="eden-system-hint eden-system-hint--loading">
                      {NPC_NAMES[activeNpc]}在思考⋯⋯
                    </div>
                  )}

                  {/* Task 1.4：低语叙事化反馈（NPC 回复与输入框之间） */}
                  {whisperFeedback.length > 0 && (
                    <div className="eden-whisper-feedback">
                      {whisperFeedback.map((line, i) => (
                        <p key={i} className="eden-whisper-feedback-line">{line}</p>
                      ))}
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
                  const hasLivingNames = (state.itemCounts?.["resonance_living_names"] ?? 0) > 0;
                  const encountered = state.encounteredNpcIds.includes(mindTabNpc);
                  // 万物名录解锁双维度数值；牵绊道具解锁该 NPC 深层关系
                  const showNumbers = hasLivingNames && encountered;
                  const BOND_ITEM: Partial<Record<EdenNpcId, string>> = {
                    eve: "resonance_her_voice",
                    adam: "resonance_quiet_stone",
                    michael: "resonance_river_dew",
                    gabriel: "resonance_herald_feather",
                    lucifer: "resonance_lucifer_star",
                    hedgehog: "resonance_hedgehog_bristle",
                  };
                  const hasBond = (n: EdenNpcId): boolean => {
                    const id = BOND_ITEM[n];
                    if (!id) return false;
                    return state.inventory.includes(id) || state.usedItemIds.includes(id);
                  };
                  const showRelation = showNumbers && hasBond(mindTabNpc);
                  const showDetailed = showNumbers;
                  const relationProfile = getNpcRelationProfile(mindTabNpc);
                  const rel = state.npcRelations?.[mindTabNpc];
                  const affinity = rel?.affinity ?? relationProfile?.initialAffinity ?? 0;

                  const fuzzyStage = (value: number): string => {
                    if (value < 25) return "疏远";
                    if (value < 50) return "平静";
                    if (value < 75) return "愿意听一会儿";
                    return "亲近";
                  };

                  if (!showDetailed) {
                    return (
                      <>
                        <div className="eden-character-header" style={{ marginTop: 12 }}>
                          <div>
                            <p className="eden-section-title">角色属性</p>
                            <p className="eden-character-name">{profile.title}</p>
                          </div>
                          <span className="eden-character-status">在{LOCATION_NAMES[state.npcLocations[mindTabNpc]]}</span>
                        </div>
                        <p className="eden-character-desc">{profile.subtitle}</p>
                        <div className="eden-psyche-display-grid">
                          {profile.rows.map((row) => (
                            <div key={row.label} className="eden-psyche-info-row">
                              <span className="eden-psyche-label">{row.label}</span>
                              <span className="eden-psyche-value eden-psyche-value--fuzzy">
                                {fuzzyStage(row.value)}
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="eden-intel-locked-hint">
                          获得「万物名录」后，才能看清每个角色的好感、性格与相处方式。
                        </p>
                      </>
                    );
                  }

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

                      {/* 第一章：关系情报（万物名录解锁数值后，需对应牵绊道具解锁深层关系） */}
                      {relationProfile && showRelation && (
                        <div className="eden-relation-intel">
                          <p className="eden-section-title">关系</p>
                          <div className="eden-psyche-info-row">
                            <span className="eden-psyche-label">好感</span>
                            <span className="eden-psyche-value">{Math.round(affinity)} / 100</span>
                          </div>
                          <p className="eden-relation-line">性格：{relationProfile.playerVisible.persona}</p>
                          <p className="eden-relation-line">在意：{relationProfile.playerVisible.caresAbout}</p>
                          <p className="eden-relation-line">更容易亲近：{relationProfile.playerVisible.closerWhen}</p>
                          <p className="eden-relation-line">会引起戒备：{relationProfile.playerVisible.waryWhen}</p>
                          <p className="eden-relation-line">
                            赠礼：{rel?.rewardClaimed ? "已获得" : rel?.rewardEligible ? "愿意赠你一件回响" : "尚浅"}
                          </p>
                        </div>
                      )}
                      {showNumbers && !showRelation && (
                        <p className="eden-intel-locked-hint">
                          获得对应牵绊后，才能看清与TA的深层关系。
                        </p>
                      )}
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
                <span className="eden-character-status">时段 {state.timeSlot}/12 · 行动 {state.actionPoints}/{getEffectiveMaxActionPoints(state)}</span>
              </div>

              <p className="eden-character-desc">
                你没有手，不能触碰果子，也不能替任何人做出选择。你的力量只剩语言——以及耐心。每一轮你有 {getEffectiveMaxActionPoints(state)} 点行动，用于移动、低语或场景互动。行动点用尽后，需要主动进入下一轮才能恢复。
              </p>

              {/* 词元消耗统计（模块4） */}
              <div style={{ marginTop: 16 }}>
                <p className="eden-section-title">词元消耗统计</p>
                <div style={{ color: "#b7b08e", fontSize: "0.85rem", display: "flex", justifyContent: "space-between" }}>
                  <span>本轮消耗</span>
                  <span>{polishTokensRound}</span>
                </div>
                <div style={{ color: "#b7b08e", fontSize: "0.85rem", display: "flex", justifyContent: "space-between" }}>
                  <span>本局累计消耗</span>
                  <span>{polishTokensTotal}</span>
                </div>
                <div style={{ color: "#9a946f", fontSize: "0.78rem", marginTop: 4 }}>
                  本次 {lastPolishTokens ?? "-"} · 本局累计 {polishTokensTotal} token
                </div>
              </div>

              {/* 当前回响Buff显示 */}
              <div style={{ marginTop: 16 }}>
                <p className="eden-section-title">当前回响赋予的Buff</p>

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
                {(!state.pendingConsumableEffects || state.pendingConsumableEffects.length === 0) &&
                 state.inventory.filter(id => getItemById(id)?.kind === "passive").length === 0 && (
                  <p className="eden-empty-hint">
                    你还没有激活任何回响Buff。在场景中探索或使用道具来获得Buff。
                  </p>
                )}
              </div>

            </div>
          )}

          {/* ===== 线索与记录 Tab ===== */}
          {activeTab === "clues" && (
            <div className="eden-character-panel" data-testid="clue-panel">
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
                    const interestTags: Partial<Record<EdenNpcId, Array<{ text: string; color?: string }>>> = {
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
                      gabriel: [
                        { text: "声音", color: "rgba(160, 170, 200, 0.2)" },
                        { text: "传话", color: "rgba(150, 180, 200, 0.2)" },
                        { text: "水流", color: "rgba(130, 170, 190, 0.2)" },
                      ],
                      michael: [
                        { text: "选择", color: "rgba(150, 150, 180, 0.2)" },
                        { text: "后果", color: "rgba(170, 140, 160, 0.2)" },
                        { text: "分流", color: "rgba(140, 160, 180, 0.2)" },
                      ],
                      lucifer: [
                        { text: "光", color: "rgba(200, 180, 120, 0.2)" },
                        { text: "支流", color: "rgba(160, 170, 100, 0.2)" },
                        { text: "提问", color: "rgba(160, 180, 120, 0.2)" },
                      ],
                      tree_of_life: [],
                      forbidden_tree: [],
                    };
                    const tagExamples: Partial<Record<EdenNpcId, Record<string, string>>> = {
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
                    data-testid={`location-card-${locId}`}
                  >
                    <span className="eden-map-hotspot-label">{loc.name}</span>
                    <span className="eden-map-hotspot-state">
                      {isCurrent ? "你在这里" : isReachable ? "可前往" : "需绕行"}
                    </span>
                    {state.unlockMapNpcLocations && (() => {
                      const npcs = getVisibleNpcsAtLocation(state, locId).filter((id) => NPC_SPRITE[id]);
                      if (!npcs.length) return null;
                      return (
                        <div className="eden-map-hotspot-avatars" aria-hidden="true">
                          {npcs.map((id) => {
                            const sprite = NPC_SPRITE[id];
                            if (!sprite) return null;
                            return (
                              <Image
                                key={id}
                                src={sprite.src}
                                alt={EDEN_NPCS[id].name}
                                width={28}
                                height={28}
                                className="eden-map-hotspot-avatar"
                                title={EDEN_NPCS[id].name}
                                style={{ objectPosition: sprite.objectPosition ?? "50% 20%" }}
                              />
                            );
                          })}
                        </div>
                      );
                    })()}
                  </button>
                );
              })}
            </div>

            {/* 选中地点详情框（单个，取代原五卡片网格） */}
            {(() => {
              const selectedLoc = EDEN_LOCATIONS[selectedMapLocationId];
              const status = getMapTravelStatus(selectedMapLocationId, state.locationId);
              const canEnter = status.kind === "reachable" && !isLoading;
              // 根据当前昼夜和动态位置获取该地点实际可见的 NPC 列表
              const visibleNpcs = getVisibleNpcsAtLocation(state, selectedMapLocationId);
              const whisperableNpcs = visibleNpcs.filter((id) => id !== "forbidden_tree" && id !== "tree_of_life");
              const worldObjects = visibleNpcs.filter((id) => id === "forbidden_tree" || id === "tree_of_life");
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
                      data-testid="world-map-enter"
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
                <h2 className="eden-map-title">
                  已解锁{" "}
                  {Array.from(
                    new Set([...state.unlockedAchievementIds, ...getUnlockedCrossSessionMarkIds()]),
                  ).length}
                  /{ACHIEVEMENTS.length}
                </h2>
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
              <AchievementGarden
                unlockedIds={Array.from(
                  new Set([...state.unlockedAchievementIds, ...getUnlockedCrossSessionMarkIds()]),
                )}
                compact
              />
            </div>
          </div>
        </div>
      )}

      {/* 输入区（固定底部，与教程统一） */}
      {isExploreActive && (
        <footer className="eden-input-footer">
          {/* 模块4：本次对话词元消耗提示 */}
          {showTurnConsumptionTip && polishTokensTurn > 0 && (
            <div className="eden-polish-consumption-tip">
              本次低语消耗 {polishTokensTurn} 词元 · 本轮累计 {polishTokensRound} · 本局累计 {polishTokensTotal}
            </div>
          )}
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
          {/* 任务 6：随处低语 - 跨场景低语对象选择（持有 gift_whisper_anywhere 时显示全场景对象） */}
          {state.divineGiftsOwned.includes("gift_whisper_anywhere") && (
            (() => {
              const targets = (Object.keys(EDEN_NPCS) as EdenNpcId[])
                .filter((id) => EDEN_NPCS[id].canWhisper && id !== "forbidden_tree" && id !== "tree_of_life")
                .sort((a, b) => {
                  const ah = state.npcLocations[a] === state.locationId ? 0 : 1;
                  const bh = state.npcLocations[b] === state.locationId ? 0 : 1;
                  return ah - bh;
                });
              return (
                <div className="eden-whisper-targets">
                  <span className="eden-whisper-targets-label">低语对象</span>
                  <div className="eden-whisper-targets-chips">
                    {targets.map((id) => {
                      const here = state.npcLocations[id] === state.locationId;
                      return (
                        <button
                          key={id}
                          type="button"
                          className={`eden-whisper-target-chip ${activeNpc === id ? "eden-whisper-target-chip--active" : ""} ${here ? "eden-whisper-target-chip--here" : "eden-whisper-target-chip--far"}`}
                          onClick={() => handleNpcInteract(id)}
                          disabled={isLoading}
                          title={here ? "在此处" : "远处"}
                        >
                          {EDEN_NPCS[id].name}
                          <span className="eden-whisper-target-chip-tag">{here ? "在此处" : "远处"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()
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
              className={`eden-btn eden-btn--polish ${polishing ? "eden-btn--polish-busy" : ""}`}
              onClick={handlePolish}
              disabled={isLoading || !activeNpc || !playerInput.trim()}
              title={polishing ? "润色中" : "润色为伊甸园中的低语"}
              aria-label={polishing ? "润色中" : "润色低语"}
              data-testid="world-polish"
            >
              {polishing ? <span className="eden-polish-spinner" aria-hidden="true" /> : "✍️"}
            </button>
            <button
              className="eden-btn eden-btn--send"
              onClick={handleSubmit}
              disabled={isLoading || !activeNpc}
            >
              {isLoading ? "⋯" : "发送"}
            </button>
            {polishError && (
              <span className="eden-polish-error" role="alert">
                风打断了低语，再试一次吧
              </span>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
