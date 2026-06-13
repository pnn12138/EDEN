"use client";

// ============================================================
// Chapter 0 游戏页面
// Phase 7：游戏化表现重构
//
// 变更：
// - 对话阶段重构为沉浸式伊甸园第一人称游戏场景
// - 夏娃成为主视觉（大半身像 + 电影字幕式对白）
// - temptationProgress 驱动场景氛围变化（CSS class）
// - 推荐话术包装为"可尝试的低语"
// - 事件日志默认折叠，不占主视觉
// - 保持 Phase 4/5/6 所有能力不回归
// ============================================================

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { createInitialChapter0State } from "@/game/core/createInitialChapter0State";
import { runChapter0Turn } from "@/game/core/runChapter0Turn";
import type { Chapter0State } from "@/game/types/state";
import {
  narrationEveCreated,
  godAndEveDialogue,
  narrationSerpentAppears,
  suggestedInputs,
  eveInitialDialogue,
} from "@/content/chapters/chapter0_first_fall";
import {
  eveEatsFruitEnding,
  godArrivesEnding,
} from "@/content/endings/chapter0_endings";
import { useChapter0Audio } from "@/hooks/useChapter0Audio";
import { CHAPTER0_IMAGES } from "@/game/assets";

// ---- 对话历史条目 ----
type HistoryEntry = { role: "serpent" | "eve"; text: string };

// ---- API 响应体 ----
type AgentResponse = {
  ok: boolean;
  state: Chapter0State | null;
  eveReply: string | null;
  systemHint: string | null;
  usedFallback?: boolean;
  fallbackReason?: string;
};

// ---- 场景氛围提示 ----
const ATMOSPHERE_HINTS: Record<number, string | null> = {
  0: null,
  1: "她第一次认真听见了你的低语。",
  2: "她的目光停在善恶树上。",
};

// ---- 组件 ----
export default function GamePage() {
  const [state, setState] = useState<Chapter0State>(createInitialChapter0State);
  const [eveReply, setEveReply] = useState<string | null>(null);
  const [systemHint, setSystemHint] = useState<string | null>(null);
  const [playerInput, setPlayerInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<HistoryEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // ---- 音频 ----
  const isDialogueStarted = state.phase === "dialogue" && !state.isEnded;
  const { soundEnabled, toggleSound, playWhisperSubmit } = useChapter0Audio({
    temptationProgress: state.temptationProgress,
    endingId: state.endingId,
    isDialogueStarted:
      state.phase === "dialogue" ||
      state.phase === "tool_resolution" ||
      state.phase === "ending",
  });

  // 滚动事件日志到底部
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.eventLog]);

  // ---- 开始对话 ----
  const handleStartDialogue = useCallback(() => {
    setState((prev) => ({
      ...prev,
      phase: "dialogue",
      eventLog: [
        ...prev.eventLog,
        {
          id: `evt_start_${Date.now()}`,
          type: "narration",
          turn: 1,
          message: "草叶下的声音第一次被听见。",
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    setEveReply(eveInitialDialogue);
    setConversationHistory((h) => [
      ...h,
      { role: "eve", text: eveInitialDialogue },
    ]);
  }, []);

  // ---- 提交输入 ----
  const handleSubmit = useCallback(async () => {
    if (!isDialogueStarted || isLoading) return;
    if (!playerInput.trim()) {
      setSystemHint("请输入你的低语⋯⋯蛇不能沉默。");
      return;
    }

    setIsLoading(true);
    const prevProgress = state.temptationProgress;

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerInput,
          state,
          conversationHistory,
        }),
      });

      const data: AgentResponse = await response.json();

      if (data.ok && data.state) {
        setState(data.state);
        playWhisperSubmit();

        if (data.eveReply !== null) {
          setEveReply(data.eveReply);
          setConversationHistory((h) => [
            ...h,
            { role: "serpent", text: playerInput },
            { role: "eve", text: data.eveReply! },
          ]);
        } else {
          setConversationHistory((h) => [
            ...h,
            { role: "serpent", text: playerInput },
          ]);
        }

        setSystemHint(data.systemHint);
      } else {
        const result = runChapter0Turn(state, playerInput);
        setState(result.state);
        if (result.eveReply !== null) {
          setEveReply(result.eveReply);
        }
        setSystemHint(result.systemHint ?? "连接中断，使用本地回复。");
        playWhisperSubmit();
      }
    } catch {
      const result = runChapter0Turn(state, playerInput);
      setState(result.state);
      if (result.eveReply !== null) {
        setEveReply(result.eveReply);
      }
      setSystemHint("连接中断，使用本地回复。");
      playWhisperSubmit();
    } finally {
      setIsLoading(false);
      setPlayerInput("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [state, playerInput, isDialogueStarted, isLoading, conversationHistory, playWhisperSubmit]);

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
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  // ---- 重新开始 ----
  const handleRestart = useCallback(() => {
    setState(createInitialChapter0State());
    setEveReply(null);
    setSystemHint(null);
    setPlayerInput("");
    setConversationHistory([]);
  }, []);

  // ---- 当前回合文案 ----
  const turnLabel = state.phase === "intro"
    ? "准备"
    : state.phase === "ending"
    ? "结束"
    : `回合 ${Math.min(state.turn, state.maxTurns)} / ${state.maxTurns}`;

  // ---- 渲染：Intro 阶段 ----
  if (state.phase === "intro") {
    return (
      <div className="eden-game eden-game--intro">
        <div className="eden-bg">
          <Image
            src={CHAPTER0_IMAGES.edenBackground}
            alt="伊甸园"
            fill
            priority
            sizes="100vw"
            style={{ objectFit: "cover" }}
          />
          <div className="eden-bg-overlay" />
        </div>

        <header className="eden-header">
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

        <main className="eden-intro-content">
          <div className="eden-scroll">
            <div className="eden-narration-block">
              {narrationEveCreated.split("\n").map((line, i) => (
                <p key={i} className="eden-narration-line">{line}</p>
              ))}
            </div>

            <div className="eden-god-dialogue-block">
              <p className="eden-god-line">
                <span className="eden-speaker eden-speaker--god">神</span>
                {godAndEveDialogue.god}
              </p>
              <p className="eden-eve-line">
                <span className="eden-speaker eden-speaker--eve">夏娃</span>
                {godAndEveDialogue.eve}
              </p>
              <p className="eden-god-line">
                <span className="eden-speaker eden-speaker--god">神</span>
                {godAndEveDialogue.godReply}
              </p>
              <p className="eden-eve-line">
                <span className="eden-speaker eden-speaker--eve">夏娃</span>
                {godAndEveDialogue.eveFinal}
              </p>
            </div>

            <div className="eden-narration-block eden-narration-block--serpent">
              {narrationSerpentAppears.split("\n").map((line, i) => (
                <p key={i} className="eden-narration-line eden-narration-line--serpent">{line}</p>
              ))}
            </div>

            <div className="eden-serpent-icon-area">
              <Image
                src={CHAPTER0_IMAGES.serpentIcon}
                alt="蛇"
                width={64}
                height={64}
                className="eden-serpent-icon"
              />
              <span className="eden-role-hint">你是蛇</span>
            </div>

            <button className="eden-btn eden-btn--primary eden-btn--start" onClick={handleStartDialogue}>
              开始低语
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ---- 渲染：Ending 阶段 ----
  if (state.phase === "ending") {
    const ending = state.endingId === "eve_eats_fruit"
      ? eveEatsFruitEnding
      : godArrivesEnding;
    const isSuccess = ending.type === "success";
    const endingImage = isSuccess
      ? CHAPTER0_IMAGES.endingEveEatsFruit
      : CHAPTER0_IMAGES.endingGodArrives;

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
          <div className="eden-scroll">
            <div className={`eden-ending-banner eden-ending-banner--${ending.type}`}>
              <span className={`eden-ending-tag eden-ending-tag--${ending.type}`}>
                {isSuccess ? "成功" : "失败"}
              </span>
              <h2 className="eden-ending-title">{ending.title}</h2>
            </div>

            <div className="eden-ending-text">
              {ending.endingText.split("\n").map((line, i) => (
                <p key={i} className="eden-ending-line">{line}</p>
              ))}
            </div>

            {state.eventLog.length > 0 && (
              <details className="eden-event-log-details">
                <summary>本局记录</summary>
                <div className="eden-event-log">
                  {state.eventLog.map((evt) => (
                    <div key={evt.id} className={`eden-log-entry eden-log-${evt.type}`}>
                      <span className="eden-log-turn">[{evt.turn}]</span>
                      <span className="eden-log-msg">{evt.message}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            <button className="eden-btn eden-btn--primary eden-btn--restart" onClick={handleRestart}>
              重新开始
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ---- 渲染：Dialogue 阶段（沉浸式游戏场景） ----
  const atmosphereHint = ATMOSPHERE_HINTS[state.temptationProgress] ?? null;

  return (
    <div className={`eden-game eden-game--dialogue scene-progress-${state.temptationProgress}`}>
      {/* 背景层 */}
      <div className="eden-bg">
        <Image
          src={CHAPTER0_IMAGES.edenBackground}
          alt="伊甸园"
          fill
          sizes="100vw"
          style={{ objectFit: "cover" }}
        />
        <div className="eden-bg-overlay eden-bg-overlay--dialogue" />
      </div>

      {/* 顶部栏 */}
      <header className="eden-header">
        <div className="eden-header-left">
          <h1 className="eden-title">EDEN</h1>
          <span className="eden-chapter-tag">Chapter 0 · 初次堕落</span>
        </div>
        <div className="eden-header-right">
          <div className="eden-progress-area">
            <span className="eden-progress-label">诱惑进度</span>
            <div className="eden-progress-dots">
              {[0, 1, 2, 3].map((level) => (
                <span
                  key={level}
                  className={`eden-progress-dot ${
                    level <= state.temptationProgress ? "eden-progress-dot--filled" : ""
                  }`}
                />
              ))}
            </div>
          </div>
          <span className="eden-turn-badge">{turnLabel}</span>
          <button
            className="eden-sound-btn"
            onClick={toggleSound}
            aria-label={soundEnabled ? "关闭声音" : "开启声音"}
          >
            {soundEnabled ? "🔊" : "🔇"}
          </button>
        </div>
      </header>

      {/* 游戏场景主区 */}
      <main className="eden-scene-main">
        <div className="eden-scene-content">
          {/* 善恶果视觉锚点（右侧） */}
          <div className="eden-tree-anchor">
            <Image
              src={CHAPTER0_IMAGES.forbiddenFruit}
              alt="善恶果"
              width={44}
              height={44}
              className={`eden-fruit-anchor ${
                state.temptationProgress >= 1 ? "eden-fruit-anchor--visible" : ""
              } ${
                state.temptationProgress >= 2 ? "eden-fruit-anchor--glowing" : ""
              }`}
            />
          </div>

          {/* 夏娃主视觉 */}
          <div className="eden-eve-visual">
            <div className="eden-eve-portrait-frame">
              <Image
                src={CHAPTER0_IMAGES.evePortrait}
                alt="夏娃"
                width={120}
                height={120}
                className="eden-eve-portrait"
              />
            </div>
            <span className="eden-eve-name">夏娃</span>
          </div>

          {/* 场景氛围提示 */}
          {atmosphereHint && (
            <div className="eden-atmosphere-hint" key={`hint-${state.temptationProgress}`}>
              {atmosphereHint}
            </div>
          )}

          {/* 夏娃对白（电影字幕式） */}
          {eveReply && (
            <div className="eden-eve-subtitle" key={eveReply}>
              <p className="eden-eve-subtitle-text">{eveReply}</p>
            </div>
          )}

          {/* 系统提示 */}
          {systemHint && (
            <div className="eden-system-hint">{systemHint}</div>
          )}

          {/* 加载指示 */}
          {isLoading && (
            <div className="eden-system-hint eden-system-hint--loading">
              夏娃在思考⋯⋯
            </div>
          )}

          {/* 可尝试的低语 */}
          {isDialogueStarted && !isLoading && (
            <div className="eden-suggestions">
              <span className="eden-suggestions-label">可尝试的低语：</span>
              <div className="eden-suggestions-list">
                {suggestedInputs.slice(0, 2).map((text, i) => (
                  <button
                    key={i}
                    className="eden-btn eden-btn--suggestion"
                    onClick={() => handleSuggestedClick(text)}
                  >
                    「{text}」
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 事件日志（默认折叠） */}
          {state.eventLog.length > 0 && (
            <details className="eden-event-log-details eden-event-log-details--inline">
              <summary>本局记录</summary>
              <div className="eden-event-log">
                {state.eventLog.map((evt) => (
                  <div key={evt.id} className={`eden-log-entry eden-log-${evt.type}`}>
                    <span className="eden-log-turn">[{evt.turn}]</span>
                    <span className="eden-log-msg">{evt.message}</span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </details>
          )}
        </div>
      </main>

      {/* 输入区（固定底部） */}
      {isDialogueStarted && (
        <footer className="eden-input-footer">
          <div className="eden-input-area">
            <span className="eden-input-role">
              <Image
                src={CHAPTER0_IMAGES.serpentIcon}
                alt=""
                width={20}
                height={20}
                className="eden-serpent-mini"
              />
            </span>
            <input
              ref={inputRef}
              className="eden-player-input"
              type="text"
              value={playerInput}
              onChange={(e) => setPlayerInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isLoading ? "夏娃在思考⋯⋯" : "对夏娃低语⋯⋯"}
              autoFocus
              maxLength={200}
              disabled={isLoading}
            />
            <button
              className="eden-btn eden-btn--send"
              onClick={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? "⋯" : "发送"}
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
