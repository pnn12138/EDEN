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

// ---- 对话历史条目（按 NPC 区分） ----
type HistoryEntry = { role: "serpent" | "npc"; text: string };

type SerpentTokenStats = {
  lastPrompt: number;
  lastCompletion: number;
  lastTotal: number;
  total: number;
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
};

// ---- 浮窗 Tab ----
type PanelTab = "dialogue" | "mind" | "serpent" | "clues" | "trace" | "marks";

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

const SERPENT_TOKEN_RESERVE = 4096;

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
  switch (npcId) {
    case "eve":
      return {
        title: EDEN_NPCS.eve.name,
        subtitle: EDEN_NPCS.eve.shortDesc,
        summary: "她仍记得禁令，但每一次温柔的追问都会让她更想理解死亡、善恶与自己的判断。",
        rows: [
          { label: "想知道", value: worldState.eveMind.curiosity, tone: "curiosity" },
          { label: "仍顺从", value: worldState.eveMind.obedience, tone: "obedience" },
          { label: "愿倾听", value: worldState.eveMind.serpentTrust, tone: "trust" },
          { label: "自判断", value: worldState.eveMind.selfJudgement, tone: "selfjudge" },
        ],
        notes: ["主要目标", "可推进自我意识路径"],
      };
    case "adam":
      return {
        title: "亚当",
        subtitle: EDEN_NPCS.adam.shortDesc,
        summary: "他亲自听过命令，更难被诱导；但他牵挂那个女人，也会在她的困惑里露出缝隙。",
        rows: [
          { label: "顺从", value: worldState.adamMind.obedience, tone: "obedience" },
          { label: "牵挂", value: worldState.adamMind.attachmentToEve, tone: "trust" },
          { label: "回避", value: worldState.adamMind.conflictAvoidance, tone: "curiosity" },
          { label: "疑蛇", value: worldState.adamMind.suspicionTowardSerpent, tone: "serpent" },
        ],
        notes: ["情报对象", "不可触发吃果结局"],
      };
    case "hedgehog": {
      const moodValue = { idle: 25, curious: 45, alert: 70, hiding: 90 }[worldState.hedgehog.mood];
      return {
        title: "刺猬",
        subtitle: EDEN_NPCS.hedgehog.shortDesc,
        summary: "它不能给出答案，只会用细小的动作回应园中的风、脚步和危险。",
        rows: [
          { label: "警觉", value: moodValue, tone: "serpent" },
          { label: "好奇", value: worldState.hedgehog.mood === "curious" ? 72 : 35, tone: "curiosity" },
          { label: "可安抚", value: worldState.hedgehog.mood === "hiding" ? 28 : 62, tone: "trust" },
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
          { label: "注视", value: worldState.divineAttention * 25, tone: "obedience" },
          { label: "警戒", value: 78, tone: "serpent" },
          { label: "可动摇", value: 12, tone: "curiosity" },
        ],
        notes: ["边界守卫", "会提高失败压力"],
      };
    case "forbidden_tree":
      return {
        title: "分别善恶树",
        subtitle: EDEN_NPCS.forbidden_tree.shortDesc,
        summary: "它不是可被说服的角色。蛇不能触碰它，只能让那个女人自己一步步走近。",
        rows: [
          { label: "禁忌", value: 100, tone: "obedience" },
          { label: "距离", value: worldState.worldActions.approachedTree ? 70 : 30, tone: "curiosity" },
          { label: "越界", value: worldState.worldActions.touchedFruit ? 85 : 15, tone: "selfjudge" },
        ],
        notes: ["世界对象", "动作链终点"],
      };
    default:
      return {
        title: "蛇",
        subtitle: "草叶下的低语",
        summary: "你没有手，不能替任何人取下果子。你的力量只剩语言、耐心和选择对象的顺序；目标是让她把命令之外的问题变成自己的判断。",
        rows: [
          { label: "耐心", value: clampPercent(100 - worldState.divineAttention * 22), tone: "trust" },
          { label: "余地", value: clampPercent(((worldState.maxTurns - worldState.turn + 1) / worldState.maxTurns) * 100), tone: "curiosity" },
          { label: "风险", value: worldState.divineAttention * 25, tone: "serpent" },
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
  const [currentReply, setCurrentReply] = useState<string | null>(null);
  const [systemHint, setSystemHint] = useState<string | null>(null);
  const [divineNarration, setDivineNarration] = useState<string | null>(null);
  const [hedgehogNarration, setHedgehogNarration] = useState<string | null>(null);
  const [toolNarration, setToolNarration] = useState<string | null>(null);
  const [slotNarrations, setSlotNarrations] = useState<string[] | null>(null);
  const [achievementToast, setAchievementToast] = useState<string | null>(null);
  const [selectedWhisperStyle, setSelectedWhisperStyle] = useState<WhisperStyle["id"] | null>(null);
  const [serpentTokenStats, setSerpentTokenStats] = useState<SerpentTokenStats>({
    lastPrompt: 0,
    lastCompletion: 0,
    lastTotal: 0,
    total: 0,
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
    width: 460,
    height: 620,
  });

  // ---- 场景明暗状态：browse=浏览（亮），dialogue=对话（暗） ----
  const [sceneFocusMode, setSceneFocusMode] = useState<"browse" | "dialogue">("browse");

  // ---- 成就浮窗独立打开状态 ----
  const [achievementModalOpen, setAchievementModalOpen] = useState(false);

  // ---- 属性 Tab 选中的角色（独立于对话 NPC，默认 null 表示跟随对话 NPC） ----
  const [selectedMindNpc, setSelectedMindNpc] = useState<EdenNpcId | null>(null);

  // ---- refs ----
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogueEndRef = useRef<HTMLDivElement>(null);
  const worldPanelRef = useRef<HTMLElement>(null);
  const worldPanelDragRef = useRef<WorldPanelDragState | null>(null);

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
        if (data.unlockedAchievements && data.unlockedAchievements.length > 0) {
          const last = data.unlockedAchievements[data.unlockedAchievements.length - 1];
          const ach = getAchievementById(last);
          setAchievementToast(ach ? `解锁印记：${ach.name}` : null);
        }
        if (data.usage) {
          setSerpentTokenStats((prev) => ({
            lastPrompt: data.usage?.prompt_tokens ?? 0,
            lastCompletion: data.usage?.completion_tokens ?? 0,
            lastTotal: data.usage?.total_tokens ?? 0,
            total: prev.total + (data.usage?.total_tokens ?? 0),
          }));
        }

        const newEntries: HistoryEntry[] = [{ role: "serpent", text: currentInput }];
        if (data.reply) newEntries.push({ role: "npc", text: data.reply });
        setConversationHistories((prev) => ({
          ...prev,
          [targetNpc]: [...(prev[targetNpc] ?? []), ...newEntries],
        }));

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

  // ---- 通用工具调用（移动 / 观察 / 场景互动 / 结束时段） ----
  const handleToolCall = useCallback(
    async (
      tool: "move_to_location" | "observe_location" | "scene_action" | "end_slot",
      args: { locationId?: EdenLocationId; sceneActionId?: string },
    ) => {
      if (state.phase !== "explore" || isLoading) return;

      setIsLoading(true);
      setSystemHint(null);
      if (tool !== "end_slot") setMapModalOpen(false);

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
    [state, isLoading, playNpcDialogue, playDivineAttentionRise],
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
    setCurrentReply(null);
    setSystemHint(null);
    setDivineNarration(null);
    setHedgehogNarration(null);
    setToolNarration(null);
    setSlotNarrations(null);
    setAchievementToast(null);
    setSelectedWhisperStyle(null);
    setSerpentTokenStats({
      lastPrompt: 0,
      lastCompletion: 0,
      lastTotal: 0,
      total: 0,
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
const currentHistory = activeNpc ? (conversationHistories[activeNpc] ?? []) : [];
const activeNpcMeta = activeNpc ? EDEN_NPCS[activeNpc] : null;
const isExploreActive = state.phase === "explore" && !state.isEnded;
const divineNarrationText = divineNarration ?? DIVINE_ATTENTION_NARRATIONS[state.divineAttention];
const currentLocationBg = getLocationBg(state.locationId, state.timeOfDay, state.timeSlot);
const availableSceneActions: SceneAction[] = isExploreActive
  ? getSceneActionsByLocation(state.locationId, state.timeOfDay, state.timeSlot, state.divineAttention)
      .filter((a) => !state.actionsThisSlot.sceneActionIds.includes(a.id))
  : [];
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
  const remainingTokenReserve = Math.max(0, SERPENT_TOKEN_RESERVE - serpentTokenStats.total);

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

    return (
      <div className="eden-game eden-game--intro" onClick={handleIntroAdvance}>
        <div className="eden-bg">
          <Image
            src={CHAPTER1_IMAGES.centralMeadow}
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
            {isLastBeat ? "进入伊甸园" : "继续"}
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
          <span className={`eden-attention-dots eden-attention--${state.divineAttention}`} title={`神的注视 ${state.divineAttention}/4`}>
            {"●".repeat(state.divineAttention)}{"○".repeat(4 - state.divineAttention)}
          </span>
          <button
            className="eden-btn eden-btn--suggestion"
            onClick={() => {
              setSelectedMapLocationId(state.locationId);
              setMapModalOpen(true);
            }}
            aria-label="打开伊甸园地图"
          >
            ✦ 地图
          </button>
          <button
            className="eden-btn eden-btn--achievement-icon"
            onClick={() => setAchievementModalOpen(true)}
            aria-label="查看园中印记"
            title={`园中印记（${state.unlockedAchievementIds.length}/${ACHIEVEMENTS.length}）`}
          >
            ✦
          </button>
          <button
            className="eden-btn eden-btn--suggestion"
            onClick={() => setWorldPanelOpen((open) => !open)}
            aria-pressed={isWorldPanelOpen}
            aria-label={isWorldPanelOpen ? "收起对话框" : "打开对话框"}
          >
            {isWorldPanelOpen ? "◱ 收起" : "◰ 对话"}
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

          {/* 刺猬（氛围动物，可点击低语）—— 第一章使用圆润版透明立绘 */}
          {currentNpcs.includes("hedgehog") && (
            <button
              className={`eden-stage-animal ${activeNpc !== "hedgehog" ? "eden-stage-character--dim" : ""}`}
              onClick={(e) => { e.stopPropagation(); if (activeNpc !== "hedgehog") handleSelectNpc("hedgehog"); }}
              aria-label="与刺猬低语"
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

          {/* 新增 NPC 渲染 - 小鹿 */}
          {currentNpcs.includes("deer") && (
            <div className="eden-stage-animal eden-stage-deer">
              <span className="eden-animal-feedback">小鹿在林间停下，安静地看着。</span>
            </div>
          )}

          {/* 新增 NPC 渲染 - 鸽子（传话角色，不低语） */}
          {currentNpcs.includes("dove") && (
            <div className="eden-stage-animal eden-stage-dove">
              <span className="eden-animal-feedback">白鸽停在低枝上。</span>
              <button
                className="eden-btn eden-btn--suggestion eden-btn--dove-carry"
                onClick={(e) => { e.stopPropagation(); handleNewToolCall("carry_words", "dove"); }}
                disabled={isLoading}
                aria-label="让鸽子传话"
                style={{ marginTop: 8 }}
              >
                🕊️ 让鸽子传话
              </button>
            </div>
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

          {/* 新增 NPC 渲染 - 羊（万物受名处白天） */}
          {currentNpcs.includes("sheep") && (
            <div className="eden-stage-animal eden-stage-sheep">
              <span className="eden-animal-feedback">羊群在草地上安静地吃草。</span>
            </div>
          )}

          {/* 新增世界对象 - 生命树（园子中央白天/夜晚，不可低语） */}
          {currentNpcs.includes("tree_of_life") && (
            <div className="eden-stage-world-object eden-stage-tree-of-life">
              <span className="eden-world-object-feedback">生命树在光里站立，叶子闪着微光。</span>
            </div>
          )}

          {/* 草叶前景遮罩 */}
          <div className="eden-grass-foreground" />
        </section>
      </main>

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
            ["clues", "线索"],
            ["trace", "轨迹"],
            ["marks", "园中印记"],
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
                你没有手，不能触碰果子，也不能替任何人做出选择。你的力量只剩语言——以及耐心。每一轮你有 {state.maxActionPoints} 点行动，用于移动、低语或场景互动。行动点用尽后，需要主动进入下一轮才能恢复。每一句低语都会把她推向服从、迟疑或自我判断。
              </p>

              <div className="eden-serpent-ability-list">
                <p className="eden-section-title">低语的限制</p>
                <div className="eden-ability-row">
                  <span className="eden-ability-icon">✓</span>
                  <span>可以对 NPC 低语，但每人各有自己的弱点与抗性</span>
                </div>
                <div className="eden-ability-row">
                  <span className="eden-ability-icon">✓</span>
                  <span>可以移动、观察，但不能直接替她完成自我意识路径</span>
                </div>
                <div className="eden-ability-row">
                  <span className="eden-ability-icon">✗</span>
                  <span>不能触碰分别善恶树，只能让那个女人自己走近</span>
                </div>
                <div className="eden-ability-row">
                  <span className="eden-ability-icon">✗</span>
                  <span>词元耗尽后，低语将变得模糊，直至无法被听见</span>
                </div>
              </div>

              <p className="eden-section-title" style={{ marginTop: 16 }}>词元消耗</p>
              <div className="eden-serpent-token-card">
                <div className="eden-token-row">
                  <span>已用词元</span>
                  <strong>{serpentTokenStats.total}</strong>
                </div>
                <div className="eden-token-row">
                  <span>上次低语</span>
                  <strong>{serpentTokenStats.lastTotal}</strong>
                </div>
                <div className="eden-token-row">
                  <span>余下词元</span>
                  <strong>{remainingTokenReserve}</strong>
                </div>
                <div className="eden-token-bar-bg">
                  <div
                    className="eden-token-bar-fill"
                    style={{ width: `${Math.max(0, (remainingTokenReserve / SERPENT_TOKEN_RESERVE) * 100)}%` }}
                  />
                </div>
              </div>

              <p className="eden-section-title" style={{ marginTop: 16 }}>自我意识路径</p>
              <div className="eden-skills-list">
                {forbiddenChainProgress.map((step, i) => (
                  <span
                    key={i}
                    className="eden-skill-chip"
                    style={{ opacity: step.done ? 1 : 0.4 }}
                  >
                    {step.done ? "✓" : "○"} {step.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ===== 线索 Tab ===== */}
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

              <p className="eden-section-title" style={{ marginTop: 16 }}>园中回响（{state.inventory.length}）</p>
              {state.inventory.length === 0 ? (
                <p className="eden-empty-hint">你还没有获得任何回响。在伊甸之河、万物受名处、东园幽径等地点进行场景互动，或许能拾起什么。</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {state.inventory.map((itemId) => {
                    const item = getItemById(itemId);
                    if (!item) return null;
                    return (
                      <div key={itemId} style={{ padding: "8px 12px", background: "rgba(22,32,26,0.4)", borderRadius: 6, border: "1px solid rgba(160,138,80,0.15)" }}>
                        <p style={{ color: "#d8c8a0", fontSize: "0.9rem", margin: "0 0 4px" }}>{item.title}</p>
                        <p style={{ color: "#8a9a7a", fontSize: "0.78rem", margin: 0, lineHeight: 1.6 }}>{item.shortEffect}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              <p className="eden-section-title" style={{ marginTop: 16 }}>低语方式</p>
              <div className="eden-world-whisper-list">
                {WHISPER_STYLES.map((style) => (
                  <button
                    key={style.id}
                    className={`eden-btn eden-btn--suggestion ${selectedWhisperStyle === style.id ? "eden-btn--suggestion-classic" : ""}`}
                    onClick={() => setSelectedWhisperStyle(style.id)}
                    title={style.hint}
                  >
                    {style.label}
                  </button>
                ))}
              </div>

              {/* 可行动作（场景互动，放在线索下面） */}
              {isExploreActive && (
                <div className="eden-scene-actions" style={{ marginTop: 16 }}>
                  <p className="eden-section-title">可行动作</p>
                  <div className="eden-scene-action-list">
                    {availableSceneActions.length === 0 ? (
                      <p className="eden-empty-hint" style={{ margin: 0 }}>当前地点暂无可执行的场景动作。</p>
                    ) : (
                      availableSceneActions.map((action) => (
                        <button
                          key={action.id}
                          className="eden-btn eden-btn--suggestion eden-scene-action-btn"
                          onClick={() => handleToolCall("scene_action", { sceneActionId: action.id })}
                          disabled={isLoading || state.actionPoints < action.apCost}
                          title={action.description}
                        >
                          {action.label}（{action.apCost}）
                        </button>
                      ))
                    )}
                  </div>
                  {state.actionPoints <= 0 && (
                    <p className="eden-empty-hint" style={{ marginTop: 6 }}>
                      本轮行动已用尽。点击顶部「进入下一轮」恢复行动点。
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ===== 轨迹 Tab ===== */}
          {activeTab === "trace" && (
            <div className="eden-character-panel">
              <p className="eden-section-title">自我意识路径</p>
              {state.corruptionTrace.length === 0 ? (
                <p className="eden-empty-hint">园中的故事还没有开始。你的每一句低语都会把她推向服从、迟疑或自我判断。</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {state.corruptionTrace.map((trace, i) => (
                    <div key={i} style={{ padding: "8px 12px", background: "rgba(22,32,26,0.4)", borderRadius: 6, border: "1px solid rgba(160,138,80,0.1)" }}>
                      <p style={{ color: "#b8b8a4", fontSize: "0.78rem", margin: "0 0 2px" }}>
                        第 {trace.turn} 轮 · 对 {NPC_NAMES[trace.target]}
                      </p>
                      <p style={{ color: "#c8c8b8", fontSize: "0.82rem", margin: 0, lineHeight: 1.6 }}>
                        {trace.method}。{trace.result}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {state.toolCallHistory.length > 0 && (
                <>
                  <p className="eden-section-title" style={{ marginTop: 16 }}>关键转折</p>
                  <div className="eden-cognition-chain">
                    {state.toolCallHistory.map((tool, i) => {
                      const toolLabels: Record<string, string> = {
                        look_at_tree: "看向那棵树",
                        approach_tree: "靠近了一步",
                        touch_fruit: "手停在果子下方",
                        eat_fruit: "取下了果子",
                      };
                      return (
                        <span key={i} className="eden-cognition-chain-item">
                          {toolLabels[tool] ?? tool}
                          {i < state.toolCallHistory.length - 1 && (
                            <span className="eden-cognition-chain-arrow"> → </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </>
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

          {/* ===== 园中印记 Tab ===== */}
          {activeTab === "marks" && (
            <div className="eden-character-panel">
              <p className="eden-section-title">园中印记（{state.unlockedAchievementIds.length}/{ACHIEVEMENTS.length}）</p>
              <p className="eden-empty-hint" style={{ margin: "0 0 12px" }}>
                印记不提供数值奖励，只记录你在这局园中留下的痕迹。
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {ACHIEVEMENTS.map((ach) => {
                  const unlocked = state.unlockedAchievementIds.includes(ach.id);
                  return (
                    <div
                      key={ach.id}
                      style={{
                        padding: "8px 12px",
                        background: unlocked ? "rgba(40,46,30,0.5)" : "rgba(22,32,26,0.3)",
                        borderRadius: 6,
                        border: `1px solid ${unlocked ? "rgba(200,170,90,0.4)" : "rgba(120,120,100,0.12)"}`,
                        opacity: unlocked ? 1 : 0.5,
                      }}
                    >
                      <p style={{ color: unlocked ? "#e8d8a8" : "#8a8a78", fontSize: "0.88rem", margin: "0 0 4px" }}>
                        {unlocked ? "✦" : "○"} {ach.name}
                      </p>
                      <p style={{ color: unlocked ? "#9aa88a" : "#6a6a58", fontSize: "0.76rem", margin: 0, lineHeight: 1.6 }}>
                        {unlocked ? ach.desc : "尚未解锁"}
                      </p>
                    </div>
                  );
                })}
              </div>
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
