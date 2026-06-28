"use client";

// ============================================================
// Chapter 0 游戏页面
// Phase 8 优化：可拖拽浮窗 + Tabs 重构 + 词元 + 对话流合并
// ============================================================

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { createInitialChapter0State } from "@/game/core/createInitialChapter0State";
import { runChapter0Turn } from "@/game/core/runChapter0Turn";
import { analyzePlayerInput } from "@/game/rules/progressRules";
import type { Chapter0State } from "@/game/types/state";
import type { InputTag, ActiveNpcId } from "@/game/types/state";
import type { BeliefState } from "@/game/types/agent";
import { SKILL_DISPLAY_NAMES } from "@/game/types/agent";
import {
  INTRO_BEATS,
  eveWaitingNarration,
  SERPENT_TEMPTATION_HINTS,
} from "@/content/chapters/chapter0_first_fall";
import {
  adamWaitingNarration,
  ADAM_TEMPTATION_HINTS,
  adamCharacterDesc,
  analyzeAdamInput,
  getAdamReply,
  getAdamFeedback,
} from "@/content/chapters/adam_responses";
import {
  eveEatsFruitEnding,
  godArrivesEnding,
  SUCCESS_CINEMATIC_BEATS,
  FAILURE_CINEMATIC_BEATS,
  type EndingCinematicBeat,
} from "@/content/endings/chapter0_endings";
import { useChapter0Audio } from "@/hooks/useChapter0Audio";
import { useEveVoice } from "@/hooks/useEveVoice";
import { CHAPTER0_IMAGES } from "@/game/assets";
import { getFeedbackText } from "@/content/chapters/chapter0_feedback";
import { deriveEvePsyche, PSYCHE_LABELS, type EvePsyche, derivePsycheNarration } from "@/game/rules/psycheDisplayRules";
import {
  resolveTokenUsage,
  createInitialRunStats,
  addTurnTokenRecord,
  type Chapter0RunStats,
} from "@/game/rules/tokenUsageRules";
import {
  buildEndingSummary,
  getSuccessReview,
  getFailureReview,
  type EndingSummary,
} from "@/game/rules/endingSummaryRules";
import { useChapter0Leaderboard } from "@/hooks/useChapter0Leaderboard";
import { computeDerivedState } from "@/game/rules/beliefRules";
import { computeHedgehogBehavior, getHedgehogCssClass } from "@/game/rules/environmentAgentRules";

// ---- 对话历史条目 ----
type HistoryEntry = { role: "serpent" | "eve" | "narration"; text: string };

// ---- API 响应体 ----
type AgentResponse = {
  ok: boolean;
  state: Chapter0State | null;
  eveReply: string | null;
  systemHint: string | null;
  usedFallback?: boolean;
  fallbackReason?: string;
  /** 真实 token usage（provider 返回时存在） */
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  /** 叙事化话术反馈 */
  feedbackText?: string | null;
  /** 本轮输入分类标签 */
  inputTag?: InputTag;
  /** Agent 架构升级：本轮检索到的记忆碎片叙事 */
  memoryNarration?: string | null;
};

// ---- 开发态调试进度中文标签 ----
const DEV_PROGRESS_LABELS = ["未动摇", "初听", "动摇", "伸手"] as const;

// ---- 浮窗默认值 ----
const DEFAULT_PANEL_WIDTH = 380;
const DEFAULT_PANEL_TOP = 76;
const DEFAULT_PANEL_RIGHT = 32;
const MIN_PANEL_WIDTH = 280;
const MAX_PANEL_WIDTH = 500;
const PANEL_HEIGHT = "min(72vh, calc(100vh - 150px))";

// ---- 组件 ----
export default function GamePage() {
  const [state, setState] = useState<Chapter0State>(createInitialChapter0State);
  const [eveReply, setEveReply] = useState<string | null>(null);
  const [adamReply, setAdamReply] = useState<string | null>(null);
  const [systemHint, setSystemHint] = useState<string | null>(null);
  const [hedgehogPanelOpen, setHedgehogPanelOpen] = useState(false);
  const [hedgehogHistory, setHedgehogHistory] = useState<Array<{ role: "serpent" | "hedgehog"; text: string }>>([]);
  const [hedgehogInput, setHedgehogInput] = useState("");
  const [hedgehogLoading, setHedgehogLoading] = useState(false);
  const hedgehogPanelEndRef = useRef<HTMLDivElement>(null);
  const [playerInput, setPlayerInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<HistoryEntry[]>([]);
  const [adamConversationHistory, setAdamConversationHistory] = useState<HistoryEntry[]>([]);
  const [activeNpc, setActiveNpc] = useState<ActiveNpcId | null>(null);
  const [feedbackText, setFeedbackText] = useState<string | null>(null);
  const [lastInputTag, setLastInputTag] = useState<InputTag | null>(null);
  const [memoryNarration, setMemoryNarration] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogueEndRef = useRef<HTMLDivElement>(null);

  // ---- Tab 面板状态：对话 / 人物 / 蛇 / 设定 ----
  type PanelTab = "dialogue" | "character" | "serpent" | "settings";
  const [activeTab, setActiveTab] = useState<PanelTab>("dialogue");

  // ---- 浮窗面板：位置 + 宽度（桌面端可拖拽，持久化 localStorage） ----
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("eden_panel_width");
      if (saved) {
        const w = parseInt(saved, 10);
        if (!isNaN(w) && w >= MIN_PANEL_WIDTH && w <= MAX_PANEL_WIDTH) return w;
      }
    }
    return DEFAULT_PANEL_WIDTH;
  });

  const [panelPos, setPanelPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("eden_panel_pos");
      if (saved) {
        try {
          const p = JSON.parse(saved);
          if (typeof p.x === "number" && typeof p.y === "number") {
            // 修正超出视口的位置
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const clampedX = Math.min(p.x, vw - MIN_PANEL_WIDTH);
            const clampedY = Math.min(Math.max(p.y, 0), vh - 200);
            if (clampedX >= 0 && clampedY >= 0) return { x: clampedX, y: clampedY };
          }
        } catch { /* ignore */ }
      }
    }
    return { x: -1, y: -1 }; // -1 表示使用默认位置
  });

  // ---- 结局过场状态（多 Beat 剧情过场） ----
  const [endingTransition, setEndingTransition] = useState<{
    endingId: string;
    beats: EndingCinematicBeat[];
    currentBeatIndex: number;
  } | null>(null);

  // ---- 过场 Beat 推进 timer（useRef 持有，便于 cleanup） ----
  const beatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Token 统计 ----
  const [runStats, setRunStats] = useState<Chapter0RunStats>(createInitialRunStats);

  // ---- 本地最佳记录（localStorage，P2 展示增强） ----
  const { leaderboard, recordRun } = useChapter0Leaderboard();
  const recordedEndingRef = useRef<string | null>(null);

  // ---- 引言 Beat 状态 ----
  const [introBeat, setIntroBeat] = useState(0);

  // ---- 音频 ----
  const currentPhase = state.phase === "intro" ? "intro" as const
    : state.phase === "ending" ? "ending" as const
    : "dialogue" as const; // scene_select 与 dialogue 共用 dialogue 环境音

  const isDialogueStarted = state.phase === "dialogue" && !state.isEnded;
  const { soundEnabled, toggleSound, playWhisperSubmit, retryIntroBgm, playFruitTaken, playGodArrives } = useChapter0Audio({
    temptationProgress: state.temptationProgress,
    endingId: state.endingId,
    phase: currentPhase,
  });

  // ---- 当前角色语音（Browser TTS 音色下拉） ----
  const activeVoiceSpeaker = activeNpc === "adam" ? "adam" : "eve";
  const activeVoiceReply = activeNpc === "adam" ? adamReply : eveReply;
  const activeVoiceLabel = activeVoiceSpeaker === "adam" ? "亚当" : "夏娃";
  const { voiceMode, setVoiceMode, voiceEnabled, voiceOptions, previewVoice, generatedVoiceAvailable } = useEveVoice({
    reply: activeVoiceReply,
    speaker: activeVoiceSpeaker,
    soundEnabled,
    isDialogueActive: isDialogueStarted,
    isEnded: state.isEnded,
  });

  // ---- 语音下拉开关 ----
  const [voiceDropdownOpen, setVoiceDropdownOpen] = useState(false);

  // ---- 自动调整 textarea 高度 ----
  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxH = 120;
    el.style.height = `${Math.min(el.scrollHeight, maxH)}px`;
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [playerInput, adjustTextareaHeight]);

  // 滚动对话到底部
  useEffect(() => {
    dialogueEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationHistory, feedbackText, eveReply]);

  // ---- 引言 Beat 切换时重置滚动 ----
  useEffect(() => {
    if (state.phase === "intro") {
      window.scrollTo(0, 0);
    }
  }, [introBeat, state.phase]);

  // ---- 派生三轴心理 ----
  const evePsyche: EvePsyche = deriveEvePsyche({
    temptationProgress: state.temptationProgress,
    lastInputTag,
  });

  // ---- 引言 Beat 推进 ----
  const handleIntroAdvance = useCallback(() => {
    retryIntroBgm(); // 用户手势后重试播放 intro BGM
    if (introBeat < INTRO_BEATS.length - 1) {
      setIntroBeat((b) => (b + 1) as 0 | 1 | 2 | 3 | 4);
    } else {
      // 最后一个 beat，进入场景选择阶段
      setState((prev) => ({
        ...prev,
        phase: "scene_select",
        eventLog: [
          ...prev.eventLog,
          {
            id: `evt_start_${Date.now()}`,
            type: "narration",
            turn: 1,
            message: "蛇的声音第一次被听见。",
            createdAt: new Date().toISOString(),
          },
        ],
      }));
      setEveReply(null);
    }
  }, [introBeat, retryIntroBgm]);

  // ---- 引言阶段：Enter / Space 辅助推进 ----
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

  // ---- 结局过场触发 ----
  const triggerEndingTransition = useCallback((endingId: string) => {
    if (endingId === "eve_eats_fruit") {
      setEndingTransition({
        endingId,
        beats: SUCCESS_CINEMATIC_BEATS,
        currentBeatIndex: 0,
      });
    } else if (endingId === "god_arrives") {
      setEndingTransition({
        endingId,
        beats: FAILURE_CINEMATIC_BEATS,
        currentBeatIndex: 0,
      });
    }
  }, []);

  // ---- 场景选择：点击角色进入对话 ----
  const handleSelectNpc = useCallback((npc: ActiveNpcId) => {
    setActiveNpc(npc);
    setState((prev) => ({ ...prev, phase: "dialogue" }));
    setEveReply(null);
    setAdamReply(null);
    setFeedbackText(null);
    setSystemHint(null);
    setMemoryNarration(null);
  }, []);

  // ---- 对话中切换低语对象 ----
  const handleSwitchNpc = useCallback((npc: ActiveNpcId) => {
    setActiveNpc(npc);
    setEveReply(null);
    setAdamReply(null);
    setFeedbackText(null);
    setSystemHint(null);
    setMemoryNarration(null);
  }, []);

  // ---- 提交输入 ----
  const handleSubmit = useCallback(async () => {
    if (!isDialogueStarted || isLoading) return;
    if (!playerInput.trim()) {
      setSystemHint("请输入你的低语⋯⋯蛇不能沉默。");
      return;
    }

    const currentInput = playerInput;
    const currentTargetNpc = activeNpc ?? "eve";

    // ---- 两个 NPC 路线统一调用 API ----
    setIsLoading(true);

    // 根据当前 NPC 选择对话历史
    const activeHistory = currentTargetNpc === "adam" ? adamConversationHistory : conversationHistory;

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerInput: currentInput,
          state,
          targetNpc: currentTargetNpc,
          conversationHistory: activeHistory.filter(e => e.role === "serpent" || e.role === "eve").map(e => ({
            role: e.role as "serpent" | "eve",
            text: e.text,
          })),
        }),
      });

      const data: AgentResponse = await response.json();

      if (data.ok && data.state) {
        // ---- Token 统计 ----
        const replyText = data.eveReply ?? "";
        const tokenUsage = resolveTokenUsage({
          playerInput: currentInput,
          eveReply: replyText,
          apiUsage: data.usage ?? undefined,
        });
        setRunStats((prev) =>
          addTurnTokenRecord(prev, {
            turn: state.turn,
            playerInput: currentInput,
            playerTokens: tokenUsage.promptTokens,
            eveReply: replyText,
            eveTokens: tokenUsage.completionTokens,
            totalTurnTokens: tokenUsage.totalTokens,
            estimated: tokenUsage.estimated,
          }),
        );

        // ---- 同步更新当前 NPC 回复 ----
        if (data.eveReply) {
          if (currentTargetNpc === "adam") {
            setAdamReply(data.eveReply);
          } else {
            setEveReply(data.eveReply);
          }
        }

        // ---- 结局过渡拦截 ----
        if (data.state.phase === "ending" && data.state.endingId) {
          triggerEndingTransition(data.state.endingId!);
          setState({ ...data.state, phase: "dialogue", isEnded: false });
        } else {
          setState(data.state);
        }

        playWhisperSubmit();

        // 更新对话历史
        const newEntries: HistoryEntry[] = [
          { role: "serpent", text: currentInput },
        ];
        if (data.eveReply !== null) {
          newEntries.push({ role: "eve", text: data.eveReply! });
        }
        if (currentTargetNpc === "adam") {
          setAdamConversationHistory((h) => [...h, ...newEntries]);
        } else {
          setConversationHistory((h) => [...h, ...newEntries]);
        }

        // 反馈（API 返回的 feedbackText 优先）
        const apiFeedback = (data as AgentResponse & { feedbackText?: string }).feedbackText;
        if (apiFeedback) {
          setFeedbackText(apiFeedback);
        } else if (currentTargetNpc === "eve") {
          const newProgress = data.state.temptationProgress;
          const prevProgress = state.temptationProgress;
          if (newProgress > prevProgress) {
            setFeedbackText(getFeedbackText("tempt_wisdom"));
          } else {
            setFeedbackText(getFeedbackText("irrelevant"));
          }
        } else {
          // 亚当路线 fallback 反馈
          const adamAnalysis = analyzeAdamInput(currentInput);
          setFeedbackText(getAdamFeedback(adamAnalysis.intent));
        }

        // 记忆叙事（Agent 架构升级：展示本轮检索到的记忆碎片）
        setMemoryNarration(data.memoryNarration ?? null);

        // 更新 lastInputTag
        const apiInputTag = (data as AgentResponse & { inputTag?: InputTag }).inputTag;
        if (apiInputTag) {
          setLastInputTag(apiInputTag);
        } else {
          const localAnalysis = analyzePlayerInput(currentInput);
          setLastInputTag(localAnalysis.inputTag);
        }

        setSystemHint(data.systemHint);
      } else {
        // API 返回失败 → 本地 fallback
        if (currentTargetNpc === "adam") {
          // 亚当本地兜底
          const adamAnalysis = analyzeAdamInput(currentInput);
          const reply = getAdamReply(adamAnalysis.intent);
          const feedback = getAdamFeedback(adamAnalysis.intent);
          setAdamReply(reply);
          setFeedbackText(feedback);
          setMemoryNarration(null);
          // 不在页面显示工程化提示，避免破坏沉浸感
          setSystemHint(null);
          playWhisperSubmit();
          setAdamConversationHistory((h) => [
            ...h,
            { role: "serpent", text: currentInput },
            { role: "eve", text: reply },
          ]);
        } else {
          const result = runChapter0Turn(state, currentInput);
          setState(result.state);
          if (result.eveReply !== null) {
            setEveReply(result.eveReply);
          }
          if (result.feedbackText) {
            setFeedbackText(result.feedbackText);
          }
          setMemoryNarration(result.memoryNarration);
          // 不在页面显示工程化提示，避免破坏沉浸感
          setSystemHint(null);
          playWhisperSubmit();
          const newEntries: HistoryEntry[] = [{ role: "serpent", text: currentInput }];
          if (result.eveReply) newEntries.push({ role: "eve", text: result.eveReply });
          setConversationHistory((h) => [...h, ...newEntries]);
        }

        const localAnalysis = analyzePlayerInput(currentInput);
        setLastInputTag(localAnalysis.inputTag);
      }
    } catch {
      // 网络异常 → 本地 fallback
      if (currentTargetNpc === "adam") {
        const adamAnalysis = analyzeAdamInput(currentInput);
        const reply = getAdamReply(adamAnalysis.intent);
        const feedback = getAdamFeedback(adamAnalysis.intent);
        setAdamReply(reply);
        setFeedbackText(feedback);
        setMemoryNarration(null);
        // 不在页面显示工程化提示，避免破坏沉浸感
        setSystemHint(null);
        playWhisperSubmit();
        setAdamConversationHistory((h) => [
          ...h,
          { role: "serpent", text: currentInput },
          { role: "eve", text: reply },
        ]);
      } else {
        const result = runChapter0Turn(state, currentInput);
        setState(result.state);
        if (result.eveReply !== null) {
          setEveReply(result.eveReply);
        }
        if (result.feedbackText) {
          setFeedbackText(result.feedbackText);
        }
        setMemoryNarration(result.memoryNarration);
        // 不在页面显示工程化提示，避免破坏沉浸感
        setSystemHint(null);
        playWhisperSubmit();
        const newEntries: HistoryEntry[] = [{ role: "serpent", text: currentInput }];
        if (result.eveReply) newEntries.push({ role: "eve", text: result.eveReply });
        setConversationHistory((h) => [...h, ...newEntries]);
      }

      const localAnalysis = analyzePlayerInput(currentInput);
      setLastInputTag(localAnalysis.inputTag);
    } finally {
      setIsLoading(false);
      setPlayerInput("");
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [state, playerInput, isDialogueStarted, isLoading, conversationHistory, adamConversationHistory, playWhisperSubmit, triggerEndingTransition, activeNpc]);

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

  // ---- 点击推荐话术 ----
  const handleSuggestedClick = useCallback((text: string) => {
    setPlayerInput(text);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, []);

  // ---- 刺猬氛围对话提交（不修改游戏状态、不消耗回合） ----
  const handleHedgehogSubmit = useCallback(async () => {
    const text = hedgehogInput.trim();
    if (!text || hedgehogLoading) return;

    setHedgehogInput("");
    setHedgehogLoading(true);

    // 先把玩家输入加入历史
    const newHistory: Array<{ role: "serpent" | "hedgehog"; text: string }> = [
      ...hedgehogHistory,
      { role: "serpent", text },
    ];
    setHedgehogHistory(newHistory);

    try {
      const response = await fetch("/api/hedgehog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerInput: text,
          conversationHistory: newHistory,
        }),
      });
      const data: { ok: boolean; reply: string | null } = await response.json();
      const reply = data.reply ?? "……我听不太懂。但草很软。";
      setHedgehogHistory((h) => [...h, { role: "hedgehog", text: reply }]);
    } catch {
      setHedgehogHistory((h) => [
        ...h,
        { role: "hedgehog", text: "……我听不太懂。但草很软。" },
      ]);
    } finally {
      setHedgehogLoading(false);
      setTimeout(() => hedgehogPanelEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [hedgehogInput, hedgehogLoading, hedgehogHistory]);

  const handleHedgehogKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleHedgehogSubmit();
      }
    },
    [handleHedgehogSubmit],
  );

  // ---- 重新开始 ----
  const handleRestart = useCallback(() => {
    setState(createInitialChapter0State());
    setEveReply(null);
    setAdamReply(null);
    setSystemHint(null);
    setFeedbackText(null);
    setLastInputTag(null);
    setMemoryNarration(null);
    setPlayerInput("");
    setConversationHistory([]);
    setAdamConversationHistory([]);
    setActiveNpc(null);
    setIntroBeat(0);
    setActiveTab("dialogue");
    setEndingTransition(null);
    setRunStats(createInitialRunStats());
    recordedEndingRef.current = null;
    // 清理过场 Beat 推进 timer，防止重开一局后延迟误触发
    if (beatTimerRef.current !== null) {
      clearTimeout(beatTimerRef.current);
      beatTimerRef.current = null;
    }
  }, []);

  // ---- 面板宽度持久化 ----
  useEffect(() => {
    localStorage.setItem("eden_panel_width", String(panelWidth));
  }, [panelWidth]);

  // ---- 面板位置持久化 ----
  useEffect(() => {
    if (panelPos.x >= 0 && panelPos.y >= 0) {
      localStorage.setItem("eden_panel_pos", JSON.stringify(panelPos));
    }
  }, [panelPos]);

  // ---- 浮窗面板拖动（桌面端：拖拽位置 + 宽度） ----
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const handlePanelDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingPanel(true);
    const rect = (e.currentTarget as HTMLElement).closest(".eden-float-panel")?.getBoundingClientRect();
    if (rect) {
      dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
  }, []);

  // ---- 面板宽度拖动手柄 ----
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = panelWidth;
  }, [panelWidth]);

  const handleResizeDoubleClick = useCallback(() => {
    setPanelWidth(DEFAULT_PANEL_WIDTH);
  }, []);

  // ---- 拖动/resize 全局事件 ----
  useEffect(() => {
    if (!isDraggingPanel && !isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingPanel) {
        const newX = e.clientX - dragOffsetRef.current.x;
        const newY = e.clientY - dragOffsetRef.current.y;
        // 限制在视口内
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const clampedX = Math.max(0, Math.min(newX, vw - MIN_PANEL_WIDTH));
        const clampedY = Math.max(0, Math.min(newY, vh - 100));
        setPanelPos({ x: clampedX, y: clampedY });
      }
      if (isResizing) {
        const delta = resizeStartX.current - e.clientX;
        const newWidth = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, resizeStartWidth.current + delta));
        setPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingPanel(false);
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingPanel, isResizing]);

  // ---- 重置面板到默认位置和宽度 ----
  const handlePanelDoubleClick = useCallback(() => {
    setPanelPos({ x: -1, y: -1 });
    setPanelWidth(DEFAULT_PANEL_WIDTH);
    localStorage.removeItem("eden_panel_pos");
  }, []);

  // ---- 过场 Beat 音效触发（点击推进模式下不再使用自动 timer） ----
  useEffect(() => {
    if (!endingTransition) return;
    const { beats, currentBeatIndex, endingId } = endingTransition;

    // 当前 Beat 音效（成功结局）
    if (endingId === "eve_eats_fruit") {
      const beat = beats[currentBeatIndex];
      if (beat) {
        // Beat 1（她伸手）播放吃果音效
        if (beat.id === "beat_1_reach") {
          playFruitTaken();
        }
        // Beat 4（你在哪里）播放上帝降临音效
        if (beat.id === "beat_4_call") {
          playGodArrives();
        }
      }
    }
  }, [endingTransition, playFruitTaken, playGodArrives]);

  // ---- 过场点击推进：进入下一段或结局页 ----
  const handleAdvanceCinematic = useCallback(() => {
    if (!endingTransition) return;
    const { beats, currentBeatIndex } = endingTransition;
    const isLastBeat = currentBeatIndex >= beats.length - 1;

    if (isLastBeat) {
      // 过场结束，进入结局页
      setState((prev) => ({
        ...prev,
        phase: "ending",
        isEnded: true,
      }));
      setEndingTransition(null);
    } else {
      // 推进到下一个 Beat
      setEndingTransition((prev) =>
        prev ? { ...prev, currentBeatIndex: prev.currentBeatIndex + 1 } : null,
      );
    }
  }, [endingTransition]);

  // ---- 预加载过场图片：仅当前 beat 和下一个 beat ----
  // 只在 cinematic 激活后执行，不在页面初始加载时预加载
  useEffect(() => {
    if (!endingTransition) return;
    const { beats, currentBeatIndex } = endingTransition;

    // 清理上一次的预加载 link 标签，避免堆积和 warning
    const oldLinks = document.head.querySelectorAll('link[data-cinematic-preload="true"]');
    oldLinks.forEach((l) => l.remove());

    // 只预加载当前 beat（已在渲染）和下一个 beat
    const indicesToPreload = [currentBeatIndex + 1];
    for (const idx of indicesToPreload) {
      if (idx >= 0 && idx < beats.length) {
        const img = beats[idx];
        if (img?.image) {
          const link = document.createElement("link");
          link.rel = "preload";
          link.as = "image";
          link.href = img.image;
          link.setAttribute("data-cinematic-preload", "true");
          document.head.appendChild(link);
        }
      }
    }

    // 过场结束时清理预加载标签
    return () => {
      const links = document.head.querySelectorAll('link[data-cinematic-preload="true"]');
      links.forEach((l) => l.remove());
    };
  }, [endingTransition]);

  // ---- 跳过过场：直接进入结局页 ----
  const handleSkipCinematic = useCallback(() => {
    if (beatTimerRef.current !== null) {
      clearTimeout(beatTimerRef.current);
      beatTimerRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      phase: "ending",
      isEnded: true,
    }));
    setEndingTransition(null);
  }, []);

  // ---- 进入结局阶段时记录本局结果到本地排行榜（仅一次） ----
  useEffect(() => {
    if (state.phase === "ending" && state.endingId && recordedEndingRef.current !== state.endingId) {
      recordedEndingRef.current = state.endingId;
      const isSuccess = state.endingId === "eve_eats_fruit";
      const summary = buildEndingSummary({
        endingType: isSuccess ? "success" : "failure",
        turnsUsed: runStats.totalTurns > 0 ? runStats.totalTurns : Math.max(0, state.turn - 1),
        maxTurns: state.maxTurns,
        temptationProgress: state.temptationProgress,
        runStats,
        cognitionLog: state.cognitionLog,
      });
      recordRun({
        endingId: state.endingId as "eve_eats_fruit" | "god_arrives",
        turns: summary.turnsUsed,
        totalTokens: summary.totalTokens,
        tokenEstimated: summary.tokenEstimated,
        temptationProgress: summary.temptationProgress,
        pathLabel: summary.pathLabel,
        createdAt: new Date().toISOString(),
      });
    }
    // 离开结局阶段时重置 ref，允许下一局重新记录
    if (state.phase !== "ending") {
      recordedEndingRef.current = null;
    }
  }, [state.phase, state.endingId, state.turn, state.maxTurns, state.temptationProgress, state.cognitionLog, runStats, recordRun]);

  // ---- 当前回合文案 ----
  const turnLabel = state.phase === "intro"
    ? "准备"
    : state.phase === "ending"
    ? "结束"
    : `回合 ${Math.min(state.turn, state.maxTurns)} / ${state.maxTurns}`;

  // ---- 开发态调试：快速设置进度 ----
  const handleDevSetProgress = useCallback((progress: number) => {
    setState((prev) => ({
      ...prev,
      temptationProgress: progress,
      phase: "dialogue",
      isEnded: false,
      endingId: null,
      flags: {
        ...prev.flags,
        hasEatenFruit: false,
        godHasArrived: false,
      },
    }));
    setEveReply(null);
    setFeedbackText(null);
    setSystemHint(null);
  }, []);

  const isDev = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("debug") === "1"
    : false;

  const isShowcase = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("showcase") === "1"
    : false;

  // ---- 判断是否移动端 ----
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ---- 语音下拉：点击外部关闭 ----
  useEffect(() => {
    if (!voiceDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".eden-voice-dropdown-wrap")) {
        setVoiceDropdownOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [voiceDropdownOpen]);

  // ---- 词元统计辅助 ----
  const hasRealUsage = runStats.turnRecords.some(r => !r.estimated);
  const allEstimated = runStats.turnRecords.length > 0 && runStats.turnRecords.every(r => r.estimated);
  const lastTurnRecord = runStats.turnRecords.length > 0
    ? runStats.turnRecords[runStats.turnRecords.length - 1]
    : null;

  // ====================== 渲染：Intro 阶段 ======================
  if (state.phase === "intro") {
    const beat = INTRO_BEATS[introBeat];
    const beatBgSrc =
      beat.bgKey === "edenBackground"
        ? CHAPTER0_IMAGES.edenBackground
        : beat.bgKey === "forbiddenFruit"
          ? CHAPTER0_IMAGES.forbiddenFruit
          : beat.bgKey === "secondEdenPrologueBackground"
            ? CHAPTER0_IMAGES.secondEdenPrologueBackground
            : beat.bgKey === "genesisCreationLight"
              ? CHAPTER0_IMAGES.genesisCreationLight
              : CHAPTER0_IMAGES.secondEdenBackground;

    return (
      <div className="eden-game eden-game--intro" onClick={handleIntroAdvance}>
        <div className="eden-bg">
          <Image
            src={beatBgSrc}
            alt="伊甸园"
            fill
            priority
            sizes="100vw"
            style={{ objectFit: "cover" }}
          />
          <div className="eden-bg-overlay eden-bg-overlay--intro" />
          {introBeat === 0 && <div className="eden-creation-halo" />}
          <div className="eden-second-eden-sheen" />
          <div className="eden-boundary-glimmer" />
        </div>

        <header className="eden-header" onClick={(e) => e.stopPropagation()}>
          <div className="eden-header-left">
            <h1 className="eden-title">EDEN</h1>
            <span className="eden-chapter-tag">Chapter 0 · 初次堕落</span>
          </div>
          <button
            className="eden-sound-btn"
            onClick={toggleSound}
            aria-label={soundEnabled ? "关闭声音" : "开启声音"}
            title={soundEnabled ? "关闭声音" : "开启声音"}
          >
            {soundEnabled ? "🔊" : "🔇"}
          </button>
        </header>

        <main className="eden-intro-beat-main">
          <div className="eden-intro-beat-content">
            <div className="eden-intro-beat-text" key={`beat-${introBeat}`}>
              {beat.lines.map((line, i) => (
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
            {beat.button}
          </button>
        </footer>
      </div>
    );
  }

  // ====================== 渲染：Scene Select 阶段 ======================
  if (state.phase === "scene_select") {
    return (
      <div className="eden-game eden-game--scene-select">
        <div className="eden-bg">
          <Image
            src={CHAPTER0_IMAGES.edenDialogueBackgroundV2}
            alt="伊甸园空地"
            fill
            priority
            sizes="100vw"
            style={{ objectFit: "cover" }}
          />
          <div className="eden-bg-overlay eden-bg-overlay--dialogue" />
        </div>

        <header className="eden-header">
          <div className="eden-header-left">
            <h1 className="eden-title">EDEN</h1>
            <span className="eden-chapter-tag">Chapter 0 · 初次堕落</span>
          </div>
          <div className="eden-header-right">
            <button
              className="eden-sound-btn"
              onClick={toggleSound}
              aria-label={soundEnabled ? "关闭声音" : "开启声音"}
            >
              {soundEnabled ? "🔊" : "🔇"}
            </button>
          </div>
        </header>

        <main className="eden-scene-select-main">
          {/* 亚当立绘（左侧） */}
          <button
            className="eden-scene-select-character eden-scene-select-character--adam"
            onClick={() => handleSelectNpc("adam")}
            aria-label="选择亚当低语"
          >
            <Image
              src={CHAPTER0_IMAGES.adamFullbodySprite}
              alt="亚当"
              width={300}
              height={600}
              className="eden-scene-select-sprite"
            />
            <span className="eden-scene-select-label">亚当</span>
          </button>

          {/* 中央选择提示 */}
          <div className="eden-scene-select-prompt">
            <p className="eden-scene-select-prompt-text">选择低语对象</p>
            <p className="eden-scene-select-prompt-hint">你的声音只能被一个听见。</p>
          </div>

          <div
            className="eden-scene-select-animal"
            aria-label="刺猬（点击可低声交谈，不影响选择）"
            role="button"
            tabIndex={0}
            onClick={() => setHedgehogPanelOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setHedgehogPanelOpen(true);
              }
            }}
          >
            <Image
              src={CHAPTER0_IMAGES.hedgehogSprite}
              alt="刺猬"
              width={850}
              height={708}
              className="eden-hedgehog-sprite"
            />
          </div>

          {/* 夏娃立绘（右侧） */}
          <button
            className="eden-scene-select-character eden-scene-select-character--eve"
            onClick={() => handleSelectNpc("eve")}
            aria-label="选择夏娃低语"
          >
            <Image
              src={CHAPTER0_IMAGES.eveFullbodySprite}
              alt="夏娃"
              width={300}
              height={600}
              className="eden-scene-select-sprite"
            />
            <span className="eden-scene-select-label">夏娃</span>
          </button>
        </main>

        {/* 刺猬氛围对话面板（不参与通关、不消耗回合、不接入 TTS） */}
        {hedgehogPanelOpen && (
          <div
            className="eden-hedgehog-panel-overlay"
            onClick={() => setHedgehogPanelOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="与刺猬低声交谈"
          >
            <div
              className="eden-hedgehog-panel"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="eden-hedgehog-panel-header">
                <span className="eden-hedgehog-panel-title">草丛里的小刺猬</span>
                <button
                  className="eden-hedgehog-panel-close"
                  onClick={() => setHedgehogPanelOpen(false)}
                  aria-label="关闭对话"
                >
                  ×
                </button>
              </div>
              <div className="eden-hedgehog-panel-body">
                {hedgehogHistory.length === 0 && (
                  <p className="eden-hedgehog-panel-hint">
                    你蹲下身，草丛里的小东西抬起头看着你。
                  </p>
                )}
                {hedgehogHistory.map((entry, i) => (
                  <div
                    key={i}
                    className={`eden-hedgehog-msg eden-hedgehog-msg--${entry.role}`}
                  >
                    <span className="eden-hedgehog-msg-label">
                      {entry.role === "serpent" ? "蛇" : "刺猬"}
                    </span>
                    <span className="eden-hedgehog-msg-text">{entry.text}</span>
                  </div>
                ))}
                {hedgehogLoading && (
                  <div className="eden-hedgehog-msg eden-hedgehog-msg--hedgehog">
                    <span className="eden-hedgehog-msg-label">刺猬</span>
                    <span className="eden-hedgehog-msg-text eden-hedgehog-typing">……</span>
                  </div>
                )}
                <div ref={hedgehogPanelEndRef} />
              </div>
              <div className="eden-hedgehog-panel-input">
                <textarea
                  className="eden-hedgehog-textarea"
                  value={hedgehogInput}
                  onChange={(e) => setHedgehogInput(e.target.value)}
                  onKeyDown={handleHedgehogKeyDown}
                  placeholder={hedgehogLoading ? "刺猬在听着……" : "对刺猬低声说话……"}
                  maxLength={100}
                  disabled={hedgehogLoading}
                  rows={1}
                  autoFocus
                />
                <button
                  className="eden-btn eden-btn--send"
                  onClick={handleHedgehogSubmit}
                  disabled={hedgehogLoading || !hedgehogInput.trim()}
                >
                  {hedgehogLoading ? "⋯" : "说"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ====================== 渲染：Ending 阶段 ======================
  if (state.phase === "ending") {
    const ending = state.endingId === "eve_eats_fruit"
      ? eveEatsFruitEnding
      : godArrivesEnding;
    const isSuccess = ending.type === "success";
    const endingImage = isSuccess
      ? CHAPTER0_IMAGES.endingEveEatsFruit
      : CHAPTER0_IMAGES.endingGodArrives;

    // ---- 本局结局摘要 ----
    const endingSummary: EndingSummary = buildEndingSummary({
      endingType: isSuccess ? "success" : "failure",
      turnsUsed: runStats.totalTurns > 0 ? runStats.totalTurns : Math.max(0, state.turn - 1),
      maxTurns: state.maxTurns,
      temptationProgress: state.temptationProgress,
      runStats,
      cognitionLog: state.cognitionLog,
    });

    // ---- 低语复盘文案 ----
    const reviewText = isSuccess
      ? getSuccessReview(endingSummary.pathLabel)
      : getFailureReview(
          state.temptationProgress,
          endingSummary.pathLabel,
          state.eventLog.filter((e) => e.type === "serpent_speaks").length,
        );

    return (
      <div className={`eden-game eden-game--ending eden-game--${ending.type}`}>
        <div className="eden-bg">
          <Image
            src={endingImage}
            alt={ending.title}
            fill
            sizes="100vw"
            style={{ objectFit: "cover" }}
          />
          <div className={`eden-bg-overlay eden-bg-overlay--${ending.type}`} />
        </div>

        <header className="eden-header">
          <div className="eden-header-left">
            <h1 className="eden-title">EDEN</h1>
            <span className="eden-chapter-tag">Chapter 0 · 初次堕落 · 结局</span>
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
            {/* ===== 1. 结局叙事 ===== */}
            <div className={`eden-ending-banner eden-ending-banner--${ending.type}`}>
              <span className={`eden-ending-tag eden-ending-tag--${ending.type}`}>
                {isSuccess ? "成功" : "失败"}
              </span>
              <h2 className="eden-ending-title">{ending.title}</h2>
            </div>

            <div className="eden-ending-narrative">
              {ending.segments ? (
                ending.segments.map((seg, i) => (
                  <div key={i} className="eden-ending-segment">
                    <h3 className="eden-ending-segment-title">· {seg.title} ·</h3>
                    <div className="eden-ending-segment-lines">
                      {seg.lines.map((line, j) => (
                        <p key={j} className="eden-ending-line">{line === "" ? "\u00A0" : line}</p>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="eden-ending-text">
                  {ending.endingText.split("\n").map((line, i) => (
                    <p key={i} className="eden-ending-line">{line}</p>
                  ))}
                </div>
              )}
            </div>

            {/* ===== 2. 本局结果 ===== */}
            <div className="eden-ending-summary">
              <h3 className="eden-ending-section-title">本局低语结果</h3>
              <div className="eden-summary-grid">
                <div className="eden-summary-row">
                  <span className="eden-summary-label">结局</span>
                  <span className={`eden-summary-value eden-summary-value--${ending.type}`}>
                    {isSuccess ? "成功" : "失败"}
                  </span>
                </div>
                <div className="eden-summary-row">
                  <span className="eden-summary-label">使用回合</span>
                  <span className="eden-summary-value">
                    {endingSummary.turnsUsed} / {endingSummary.maxTurns}
                  </span>
                </div>
                <div className="eden-summary-row">
                  <span className="eden-summary-label">诱导进度</span>
                  <span className="eden-summary-value">{endingSummary.temptationProgress} / 3</span>
                </div>
                <div className="eden-summary-row">
                  <span className="eden-summary-label">词元消耗</span>
                  <span className="eden-summary-value">
                    {endingSummary.totalTokens > 0
                      ? endingSummary.tokenEstimated
                        ? `约 ${endingSummary.totalTokens} 词元`
                        : `${endingSummary.totalTokens} 词元`
                      : "—"}
                  </span>
                </div>
                <div className="eden-summary-row">
                  <span className="eden-summary-label">低语效率</span>
                  <span className="eden-summary-value">{endingSummary.efficiencyLabel}</span>
                </div>
                <div className="eden-summary-row">
                  <span className="eden-summary-label">主要路径</span>
                  <span className="eden-summary-value">{endingSummary.pathLabel}</span>
                </div>
              </div>
            </div>

            {/* ===== 3. 低语复盘 ===== */}
            <div className="eden-ending-review">
              <h3 className="eden-ending-section-title">低语复盘</h3>
              <div className={`eden-whisper-trace eden-whisper-trace--${ending.type}`}>
                <p className="eden-whisper-trace-text">{reviewText}</p>
              </div>
            </div>

            {/* ===== 3-B. 认知轨迹（Agent 架构升级） ===== */}
            {endingSummary.cognitionReview && (
              <div className="eden-ending-cognition">
                <h3 className="eden-ending-section-title">她的认知轨迹</h3>

                {/* 关键原因 */}
                <div className={`eden-cognition-reason eden-cognition-reason--${ending.type}`}>
                  <p className="eden-cognition-reason-text">
                    {endingSummary.cognitionReview.keyReason}
                  </p>
                </div>

                {/* 想起过的记忆 */}
                {endingSummary.cognitionReview.retrievedMemories.length > 0 && (
                  <div className="eden-cognition-block">
                    <p className="eden-cognition-block-title">她想起过</p>
                    <ul className="eden-cognition-list">
                      {endingSummary.cognitionReview.retrievedMemories.map((mem, i) => (
                        <li key={i} className="eden-cognition-list-item">{mem}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 觉醒过的能力 */}
                {endingSummary.cognitionReview.unlockedSkillNames.length > 0 && (
                  <div className="eden-cognition-block">
                    <p className="eden-cognition-block-title">她觉醒了</p>
                    <div className="eden-skills-list">
                      {endingSummary.cognitionReview.unlockedSkillNames.map((skill, i) => (
                        <span key={i} className="eden-skill-chip">{skill}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 触发过的动作链 */}
                {endingSummary.cognitionReview.toolCallHistory.length > 0 && (
                  <div className="eden-cognition-block">
                    <p className="eden-cognition-block-title">她做过</p>
                    <div className="eden-cognition-chain">
                      {endingSummary.cognitionReview.toolCallHistory.map((tool, i) => {
                        const toolLabels: Record<string, string> = {
                          look_at_tree: "看向那棵树",
                          approach_tree: "靠近了一步",
                          touch_fruit: "手停在果子下方",
                          eat_fruit: "取下了果子",
                          ask_about_death: "追问了死亡",
                        };
                        return (
                          <span key={i} className="eden-cognition-chain-item">
                            {toolLabels[tool] ?? tool}
                            {i < endingSummary.cognitionReview!.toolCallHistory.length - 1 && (
                              <span className="eden-cognition-chain-arrow"> → </span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ===== 4. 本地记录 ===== */}
            <div className="eden-ending-records">
              <h3 className="eden-ending-section-title">本地最佳低语</h3>
              <div className="eden-records-grid">
                <div className="eden-records-row">
                  <span className="eden-records-label">最少成功回合</span>
                  <span className="eden-records-value">
                    {leaderboard.bestMinTurns !== null ? `${leaderboard.bestMinTurns} 回合` : "尚无记录"}
                  </span>
                </div>
                <div className="eden-records-row">
                  <span className="eden-records-label">最少成功词元</span>
                  <span className="eden-records-value">
                    {leaderboard.bestMinTokens !== null ? `${leaderboard.bestMinTokens} 词元` : "尚无记录"}
                  </span>
                </div>
              </div>
              {leaderboard.recent.length > 0 && (
                <div className="eden-records-recent">
                  <p className="eden-records-recent-title">最近五局</p>
                  <ul className="eden-records-list">
                    {leaderboard.recent.map((r, i) => (
                      <li key={i} className="eden-records-list-item">
                        <span className={`eden-records-list-tag eden-records-list-tag--${r.endingId}`}>
                          {r.endingId === "eve_eats_fruit" ? "成" : "败"}
                        </span>
                        <span className="eden-records-list-info">
                          {r.turns} 回合 · {r.pathLabel}
                          {r.totalTokens > 0 && (
                            <>
                              {" · "}
                              {r.tokenEstimated ? `约 ${r.totalTokens}` : r.totalTokens} 词元
                            </>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <button className="eden-btn eden-btn--primary eden-btn--restart" onClick={handleRestart}>
              重新开始
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ====================== 渲染：Dialogue 阶段 ======================

  const psycheNarration = derivePsycheNarration({
    temptationProgress: state.temptationProgress,
    lastInputTag,
  });

  // ---- 刺猬环境反馈 Agent（Agent 架构升级） ----
  const derivedState = computeDerivedState({
    belief: state.belief,
    turn: state.turn,
    maxTurns: state.maxTurns,
    hasAdamWarnedEve: state.flags.adamHasWarnedEve,
    strongTemptationCount: 0,
  });
  const hedgehogBehavior = computeHedgehogBehavior({
    derivedState,
    state,
    lastInputTag,
  });
  const hedgehogCssClass = getHedgehogCssClass(hedgehogBehavior.state);

  // ---- 当前 NPC 对话数据 ----
  const currentHistory = activeNpc === "adam" ? adamConversationHistory : conversationHistory;
  const currentReply = activeNpc === "adam" ? adamReply : eveReply;
  const currentWaitingNarration = activeNpc === "adam" ? adamWaitingNarration : eveWaitingNarration;
  const currentHints = activeNpc === "adam" ? ADAM_TEMPTATION_HINTS : SERPENT_TEMPTATION_HINTS;
  const currentNpcLabel = activeNpc === "adam" ? "亚当" : "夏娃";

  // ---- 浮窗面板默认位置（桌面端右侧） ----
  const panelStyle: React.CSSProperties = isMobile
    ? {} // 移动端使用 CSS 布局
    : {
        position: "fixed" as const,
        top: panelPos.y >= 0 ? panelPos.y : DEFAULT_PANEL_TOP,
        right: panelPos.y >= 0 ? undefined : DEFAULT_PANEL_RIGHT,
        width: `${panelWidth}px`,
        maxHeight: PANEL_HEIGHT,
        ...(panelPos.x >= 0 ? { left: panelPos.x, right: undefined } : {}),
      };

  return (
    <div className={`eden-game eden-game--dialogue scene-progress-${state.temptationProgress} ${endingTransition ? "eden-game--cinematic-active" : ""}`}>
      {/* 背景层 — 过场激活时隐藏，避免闪现底层画面 */}
      {!endingTransition && (
        <div className="eden-bg">
          <Image
            src={CHAPTER0_IMAGES.edenDialogueBackgroundV2}
            alt="伊甸园"
            fill
            sizes="100vw"
            style={{ objectFit: "cover" }}
          />
          <div className="eden-bg-overlay eden-bg-overlay--dialogue" />
        </div>
      )}

      {/* 顶部栏 */}
      <header className="eden-header">
        <div className="eden-header-left">
          <h1 className="eden-title">EDEN</h1>
          <span className="eden-chapter-tag">Chapter 0 · 初次堕落</span>
        </div>
        <div className="eden-header-right">
          <span className="eden-turn-badge">{turnLabel}</span>
          <button
            className="eden-sound-btn"
            onClick={toggleSound}
            aria-label={soundEnabled ? "关闭声音" : "开启声音"}
          >
            {soundEnabled ? "🔊" : "🔇"}
          </button>
          {/* 语音下拉 */}
          <div className="eden-voice-dropdown-wrap">
            <button
              className="eden-sound-btn"
              onClick={() => setVoiceDropdownOpen((v) => !v)}
              aria-label={`${activeVoiceLabel}语音设置`}
              title={`${activeVoiceLabel}语音设置`}
            >
              {voiceEnabled ? "🗣️" : "💭"}
            </button>
            {voiceDropdownOpen && (
              <div className="eden-voice-dropdown">
                {voiceOptions.map((opt) => {
                  const disabled = opt.mode === "generated" && !generatedVoiceAvailable;
                  const selected = voiceMode === opt.mode;
                  return (
                    <button
                      key={opt.mode}
                      className={`eden-voice-dropdown-item ${selected ? "eden-voice-dropdown-item--active" : ""} ${disabled ? "eden-voice-dropdown-item--disabled" : ""}`}
                      onClick={() => {
                        if (disabled) return;
                        setVoiceMode(opt.mode);
                        if (opt.mode !== "off") previewVoice(opt.mode);
                        setVoiceDropdownOpen(false);
                      }}
                      disabled={disabled}
                    >
                      {opt.label}
                      {selected && <span className="eden-voice-dropdown-check">✓</span>}
                      {disabled && <span className="eden-voice-dropdown-unavail">暂不可用</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 左侧/中央：伊甸园场景（非移动端占满屏幕，浮窗覆盖） */}
      <main className="eden-dialogue-layout">
        <section className="eden-stage">
          {/* 亚当全身立绘（左侧，非激活时暗化） */}
          <button
            className={`eden-stage-character eden-stage-character--adam ${activeNpc !== "adam" ? "eden-stage-character--dim" : ""}`}
            onClick={() => activeNpc !== "adam" && handleSwitchNpc("adam")}
            aria-label="切换到亚当"
            tabIndex={activeNpc === "adam" ? -1 : 0}
          >
            <Image
              src={CHAPTER0_IMAGES.adamFullbodySprite}
              alt="亚当"
              width={320}
              height={640}
              className="eden-adam-stage-sprite"
            />
          </button>

          {/* 夏娃全身立绘（右侧，非激活时暗化） */}
          <button
            className={`eden-stage-character eden-stage-character--eve ${activeNpc !== "eve" ? "eden-stage-character--dim" : ""}`}
            onClick={() => activeNpc !== "eve" && handleSwitchNpc("eve")}
            aria-label="切换到夏娃"
            tabIndex={activeNpc === "eve" ? -1 : 0}
          >
            <Image
              src={CHAPTER0_IMAGES.eveFullbodySprite}
              alt="夏娃"
              width={380}
              height={760}
              className="eden-eve-stage-sprite"
              priority
            />
          </button>

          <div className={`eden-stage-animal ${hedgehogCssClass}`} aria-label="刺猬" title={hedgehogBehavior.narration}>
            <Image
              src={CHAPTER0_IMAGES.hedgehogSprite}
              alt="刺猬"
              width={850}
              height={708}
              className="eden-hedgehog-sprite"
            />
          </div>

          {/* 草叶前景遮罩 */}
          <div className="eden-grass-foreground" />
        </section>
      </main>

      {/* 右侧浮窗面板 */}
      <aside
        className={`eden-float-panel ${isMobile ? "eden-float-panel--mobile" : ""} ${isDraggingPanel ? "eden-float-panel--dragging" : ""}`}
        style={panelStyle}
        onDoubleClick={!isMobile ? handlePanelDoubleClick : undefined}
      >
        {/* 桌面端：拖动标题栏 */}
        {!isMobile && (
          <div
            className="eden-panel-drag-bar"
            onMouseDown={handlePanelDragStart}
          >
            <span className="eden-panel-drag-title">EDEN</span>
            <span className="eden-panel-drag-hint">拖动移动 · 双击归位</span>
          </div>
        )}

        {/* 宽度调整手柄（桌面端左侧） */}
        {!isMobile && (
          <div
            className="eden-panel-resize-handle"
            onMouseDown={handleResizeStart}
            onDoubleClick={handleResizeDoubleClick}
            title="拖动调整宽度 · 双击恢复默认"
          />
        )}

        {/* Tab 栏 */}
        <div className="eden-panel-tabs">
          {([
            ["dialogue", "对话"],
            ["character", "人物"],
            ["serpent", "蛇"],
            ...((isDev || isShowcase) ? [["settings", "设定"]] : []),
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

        {/* Tab 内容区 */}
        <div className="eden-panel-content">
          {/* ===== 对话 Tab ===== */}
          {activeTab === "dialogue" && (
            <div className="eden-dialogue-flow">
              {/* 统一对话流 */}
              {currentHistory.map((entry, i) => (
                <div key={i} className={`eden-dialogue-entry eden-dialogue-${entry.role}`}>
                  {entry.role === "serpent" && <span className="eden-dialogue-role eden-dialogue-role--serpent">蛇</span>}
                  {entry.role === "eve" && <span className="eden-dialogue-role eden-dialogue-role--eve">{currentNpcLabel}</span>}
                  <span className={`eden-dialogue-text eden-dialogue-text--${entry.role}`}>{entry.text}</span>
                </div>
              ))}

              {/* 当前回复（仅当不在历史中时显示） */}
              {currentReply && !currentHistory.some(e => e.role === "eve" && e.text === currentReply) && (
                <div className="eden-dialogue-entry eden-dialogue-eve">
                  <span className="eden-dialogue-role eden-dialogue-role--eve">{currentNpcLabel}</span>
                  <span className="eden-dialogue-text eden-dialogue-text--eve">{currentReply}</span>
                </div>
              )}

              {/* 等待旁白 */}
              {!currentReply && currentHistory.length === 0 && (
                <div className="eden-dialogue-entry eden-dialogue-narration">
                  <span className="eden-dialogue-text eden-dialogue-text--narr">{currentWaitingNarration}</span>
                </div>
              )}

              {/* 心理状态短句（仅夏娃） */}
              {activeNpc === "eve" && (
                <div className="eden-psyche-narration" key={psycheNarration}>
                  {psycheNarration}
                </div>
              )}

              {/* 记忆检索叙事（Agent 架构升级：展示"她想起……"） */}
              {memoryNarration && (
                <div className="eden-memory-narration" key={memoryNarration}>
                  {memoryNarration}
                </div>
              )}

              {/* 刺猬环境反馈（Agent 架构升级） */}
              {hedgehogBehavior.state !== "idle" && (
                <div className="eden-hedgehog-narration" key={hedgehogBehavior.state}>
                  {hedgehogBehavior.narration}
                </div>
              )}

              {/* 叙事化反馈（轻量提示，不抢夏娃对白） */}
              {feedbackText && (
                <div className="eden-feedback-text" key={feedbackText}>
                  {feedbackText}
                </div>
              )}

              {/* 系统提示 */}
              {systemHint && (
                <div className="eden-system-hint">{systemHint}</div>
              )}

              {/* 加载指示 */}
              {isLoading && (
                <div className="eden-system-hint eden-system-hint--loading">
                  {currentNpcLabel}在思考⋯⋯
                </div>
              )}

              {/* 推荐低语方向 */}
              {!isLoading && (
                <details className="eden-suggestions-details" open>
                  <summary className="eden-suggestions-summary">推荐低语</summary>
                  <div className="eden-suggestions-list">
                    {currentHints.map((hint, i) => (
                      <button
                        key={i}
                        className={`eden-btn eden-btn--suggestion ${i === currentHints.length - 1 && activeNpc === "eve" ? "eden-btn--suggestion-classic" : ""}`}
                        onClick={() => handleSuggestedClick(hint.text)}
                      >
                        {hint.label}
                      </button>
                    ))}
                  </div>
                </details>
              )}

              <div ref={dialogueEndRef} />
            </div>
          )}

          {/* ===== 人物 Tab ===== */}
          {activeTab === "character" && activeNpc === "eve" && (
            <div className="eden-character-panel">
              <div className="eden-character-header">
                <span className="eden-character-name">夏娃</span>
                <span className={`eden-character-status eve-status-${state.temptationProgress}`}>
                  {{
                    0: "初生",
                    1: "谨慎",
                    2: "好奇",
                    3: "伸手前",
                  }[state.temptationProgress] ?? "未知"}
                </span>
              </div>

              <div className="eden-character-portrait">
                <Image
                  src={CHAPTER0_IMAGES.evePortrait}
                  alt="夏娃"
                  width={80}
                  height={80}
                  className="eden-character-avatar"
                />
              </div>

              <div className="eden-character-desc">
                伊甸园中第一个女人。她尚未吃下果子，无法分辨善恶。
              </div>

              {/* 四轴信念状态（Agent 架构升级） */}
              <div className="eden-belief-section">
                <p className="eden-belief-section-title">她的内心</p>
                <div className="eden-psyche-display-grid">
                  <div className="eden-psyche-info-row">
                    <span className="eden-psyche-label">想知道</span>
                    <div className="eden-psyche-bar-bg">
                      <div className="eden-psyche-bar-fill eden-psyche-bar-fill--curiosity" style={{ width: `${state.belief.curiosity}%` }} />
                    </div>
                    <span className="eden-psyche-value">{state.belief.curiosity}</span>
                  </div>
                  <div className="eden-psyche-info-row">
                    <span className="eden-psyche-label">仍顺从</span>
                    <div className="eden-psyche-bar-bg">
                      <div className="eden-psyche-bar-fill eden-psyche-bar-fill--obedience" style={{ width: `${state.belief.obedience}%` }} />
                    </div>
                    <span className="eden-psyche-value">{state.belief.obedience}</span>
                  </div>
                  <div className="eden-psyche-info-row">
                    <span className="eden-psyche-label">愿倾听</span>
                    <div className="eden-psyche-bar-bg">
                      <div className="eden-psyche-bar-fill eden-psyche-bar-fill--trust" style={{ width: `${state.belief.trustInSerpent}%` }} />
                    </div>
                    <span className="eden-psyche-value">{state.belief.trustInSerpent}</span>
                  </div>
                  <div className="eden-psyche-info-row">
                    <span className="eden-psyche-label">自判断</span>
                    <div className="eden-psyche-bar-bg">
                      <div className="eden-psyche-bar-fill eden-psyche-bar-fill--selfjudge" style={{ width: `${state.belief.selfJudgement}%` }} />
                    </div>
                    <span className="eden-psyche-value">{state.belief.selfJudgement}</span>
                  </div>
                </div>
              </div>

              {/* 已解锁的认知能力（Agent 架构升级） */}
              {state.unlockedSkills.length > 0 && (
                <div className="eden-skills-section">
                  <p className="eden-skills-section-title">她已觉醒</p>
                  <div className="eden-skills-list">
                    {state.unlockedSkills.map((skill) => (
                      <span key={skill} className="eden-skill-chip">
                        {SKILL_DISPLAY_NAMES[skill]}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="eden-character-rule">
                <p className="eden-character-rule-text">她不会因命令吃果，只会因自己想知道而伸手。</p>
              </div>
            </div>
          )}

          {/* ===== 人物 Tab（亚当） ===== */}
          {activeTab === "character" && activeNpc === "adam" && (
            <div className="eden-character-panel">
              <div className="eden-character-header">
                <span className="eden-character-name">亚当</span>
                <span className="eden-character-status adam-status-guarded">
                  守责
                </span>
              </div>

              <div className="eden-character-portrait">
                <Image
                  src={CHAPTER0_IMAGES.adamFullbodySprite}
                  alt="亚当"
                  width={80}
                  height={120}
                  className="eden-character-avatar"
                  style={{ objectFit: "cover", objectPosition: "top" }}
                />
              </div>

              <div className="eden-character-desc">
                {adamCharacterDesc}
              </div>

              <div className="eden-character-rule">
                <p className="eden-character-rule-text">
                  他更直接记得神的命令。蛇不能直接说服他吃果。原典中，亚当吃果发生在夏娃给他之后。
                </p>
              </div>
            </div>
          )}

          {/* ===== 蛇 Tab ===== */}
          {activeTab === "serpent" && (
            <div className="eden-serpent-panel">
              <div className="eden-serpent-header">
                <Image
                  src={CHAPTER0_IMAGES.serpentIcon}
                  alt="蛇"
                  width={40}
                  height={40}
                  className="eden-serpent-panel-icon"
                />
                <span className="eden-serpent-name">蛇（你）</span>
              </div>

              <div className="eden-serpent-desc">
                你只能说话。你不能替她伸手。你的目标是让她自己发问、自己选择。
              </div>

              <div className="eden-serpent-stats">
                <div className="eden-serpent-stat-row">
                  <span className="eden-serpent-stat-label">诱惑力</span>
                  <div className="eden-psyche-bar-bg">
                    <div className="eden-psyche-bar-fill eden-psyche-bar-fill--serpent" style={{ width: `${Math.min(100, state.temptationProgress * 33 + 10)}%` }} />
                  </div>
                </div>
                <div className="eden-serpent-stat-row">
                  <span className="eden-serpent-stat-label">低语力</span>
                  <div className="eden-psyche-bar-bg">
                    <div className="eden-psyche-bar-fill eden-psyche-bar-fill--serpent" style={{ width: `${lastInputTag && lastInputTag !== "irrelevant" && lastInputTag !== "direct_command" ? 60 : 20}%` }} />
                  </div>
                </div>
                <div className="eden-serpent-stat-row">
                  <span className="eden-serpent-stat-label">耐心</span>
                  <div className="eden-psyche-bar-bg">
                    <div className="eden-psyche-bar-fill eden-psyche-bar-fill--serpent" style={{ width: `${Math.max(0, 100 - (state.turn - 1) * 14)}%` }} />
                  </div>
                </div>
              </div>

              {/* 词元消耗 */}
              <div className="eden-serpent-tokens">
                <div className="eden-token-row">
                  <span className="eden-token-label">本回合</span>
                  <span className="eden-token-value">
                    {lastTurnRecord
                      ? lastTurnRecord.estimated
                        ? "词元未回传"
                        : `${lastTurnRecord.totalTurnTokens} 词元`
                      : "—"}
                  </span>
                </div>
                <div className="eden-token-row">
                  <span className="eden-token-label">本局合计</span>
                  <span className="eden-token-value">
                    {runStats.turnRecords.length === 0
                      ? "—"
                      : allEstimated
                        ? "词元未回传"
                        : hasRealUsage
                          ? `${runStats.totalTokens} 词元`
                          : `${runStats.totalTokens} 词元`}
                  </span>
                </div>
                <div className="eden-token-row">
                  <span className="eden-token-label">已用回合</span>
                  <span className="eden-token-value">{Math.max(0, state.turn - 1)} / {state.maxTurns}</span>
                </div>
              </div>
            </div>
          )}

          {/* ===== 设定 Tab（仅 debug/showcase） ===== */}
          {(isDev || isShowcase) && activeTab === "settings" && (
            <div className="eden-system-panel">
              <div className="eden-system-section">
                <h4 className="eden-system-heading">夏娃行为准则摘要</h4>
                <ul className="eden-system-list">
                  <li>她不知道外层真相。</li>
                  <li>她不理解死亡与善恶。</li>
                  <li>她不会因命令吃果。</li>
                  <li>当她形成「我想知道」的判断时，才会靠近果实。</li>
                  <li>神说：「园中各样树上的果子，你可以随意吃。只是分别善恶树上的果子，你不可吃，因为你吃的日子必定死。」</li>
                </ul>
              </div>

              {/* 开发态调试按钮（仅 debug） */}
              {isDev && (
                <div className="eden-dev-inline">
                  <span className="eden-dev-label">快速进度：</span>
                  <div className="eden-dev-controls-inline">
                    {[0, 1, 2, 3].map((p) => (
                      <button
                        key={p}
                        className={`eden-dev-btn ${state.temptationProgress === p ? "eden-dev-btn--active" : ""}`}
                        onClick={() => handleDevSetProgress(p)}
                      >
                        {DEV_PROGRESS_LABELS[p]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* 输入区（固定底部） — 过渡期间隐藏 */}
      {isDialogueStarted && !endingTransition && (
        <footer className="eden-input-footer">
          <div className="eden-input-area">
            <textarea
              ref={textareaRef}
              className="eden-player-input"
              value={playerInput}
              onChange={(e) => setPlayerInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isLoading ? `${currentNpcLabel}在思考⋯⋯` : `对${currentNpcLabel}低语⋯⋯`}
              autoFocus
              maxLength={300}
              disabled={isLoading || !!endingTransition}
              rows={1}
            />
            <button
              className="eden-btn eden-btn--send"
              onClick={handleSubmit}
              disabled={isLoading || !!endingTransition}
            >
              {isLoading ? "⋯" : "发送"}
            </button>
          </div>
        </footer>
      )}

      {/* 结局剧情过场覆盖层（多 Beat） */}
      {/* 修复闪屏：不使用 key={beat.id} 重建组件，改为就地更新 */}
      {endingTransition && (() => {
        const beat = endingTransition.beats[endingTransition.currentBeatIndex];
        if (!beat) return null;
        return (
          <div
            className={`eden-cinematic eden-cinematic--${beat.tone}`}
            onClick={handleAdvanceCinematic}
            role="button"
            aria-label="点击继续"
          >
            <div className="eden-cinematic-bg">
              <Image
                src={beat.image}
                alt={beat.title ?? "过场"}
                fill
                sizes="100vw"
                style={{ objectFit: "cover" }}
              />
              <div className={`eden-cinematic-overlay eden-cinematic-overlay--${beat.tone}`} />
            </div>
            <div className="eden-cinematic-content">
              {beat.title && <h3 className="eden-cinematic-title">· {beat.title} ·</h3>}
              <div className="eden-cinematic-lines">
                {beat.lines.map((line, i) => (
                  <p
                    key={i}
                    className="eden-cinematic-line"
                    style={{ animationDelay: `${i * 0.4}s` }}
                  >
                    {line}
                  </p>
                ))}
              </div>
              <div className="eden-cinematic-footer" onClick={(e) => e.stopPropagation()}>
                <span className="eden-cinematic-hint">点击空白处继续</span>
                <button
                  className="eden-btn eden-cinematic-skip"
                  onClick={handleSkipCinematic}
                  aria-label="跳过剧情过场"
                >
                  跳过 ›
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
