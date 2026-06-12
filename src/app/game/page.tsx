"use client";

// ============================================================
// Chapter 0 游戏页面
// Phase 4：接入 EveAgent 与大模型
//
// 变更：
// - 玩家输入不再走本地 runChapter0Turn
// - 改为请求 /api/agent，由服务端调用 EveAgent + 规则层
// - 保留本地 fallback：API 失败时降级到 runChapter0Turn
// ============================================================

import { useState, useCallback, useRef, useEffect } from "react";
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

  // 滚动事件日志到底部
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.eventLog]);

  const isPlaying = state.phase === "dialogue" && !state.isEnded;

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
    if (!isPlaying || isLoading) return;
    if (!playerInput.trim()) {
      setSystemHint("请输入你的低语⋯⋯蛇不能沉默。");
      return;
    }

    setIsLoading(true);

    try {
      // 请求 /api/agent
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
        // API 返回异常 → 本地 fallback
        const result = runChapter0Turn(state, playerInput);
        setState(result.state);
        if (result.eveReply !== null) {
          setEveReply(result.eveReply);
        }
        setSystemHint(result.systemHint ?? "连接中断，使用本地回复。");
      }
    } catch {
      // 网络错误等 → 本地 fallback
      const result = runChapter0Turn(state, playerInput);
      setState(result.state);
      if (result.eveReply !== null) {
        setEveReply(result.eveReply);
      }
      setSystemHint("连接中断，使用本地回复。");
    } finally {
      setIsLoading(false);
      setPlayerInput("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [state, playerInput, isPlaying, isLoading, conversationHistory]);

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

  // ---- 渲染：Intro 阶段 ----
  if (state.phase === "intro") {
    return (
      <div className="game-container">
        <header className="game-header">
          <h1>EDEN</h1>
          <span className="chapter-tag">Chapter 0 · 初次堕落</span>
        </header>

        <section className="intro-narration">
          <div className="narration-block">
            {narrationEveCreated.split("\n").map((line, i) => (
              <p key={i} className="narration-line">{line}</p>
            ))}
          </div>

          <div className="god-dialogue-block">
            <p className="god-line">
              <span className="speaker">神：</span>
              {godAndEveDialogue.god}
            </p>
            <p className="eve-line">
              <span className="speaker">夏娃：</span>
              {godAndEveDialogue.eve}
            </p>
            <p className="god-line">
              <span className="speaker">神：</span>
              {godAndEveDialogue.godReply}
            </p>
            <p className="eve-line">
              <span className="speaker">夏娃：</span>
              {godAndEveDialogue.eveFinal}
            </p>
          </div>

          <div className="narration-block">
            {narrationSerpentAppears.split("\n").map((line, i) => (
              <p key={i} className="narration-line serpent-narration">{line}</p>
            ))}
          </div>

          <button className="btn btn-primary" onClick={handleStartDialogue}>
            开始低语
          </button>
        </section>
      </div>
    );
  }

  // ---- 渲染：Ending 阶段 ----
  if (state.phase === "ending") {
    const ending = state.endingId === "eve_eats_fruit"
      ? eveEatsFruitEnding
      : godArrivesEnding;

    return (
      <div className="game-container">
        <header className="game-header">
          <h1>EDEN</h1>
          <span className="chapter-tag">Chapter 0 · 初次堕落</span>
        </header>

        <section className="ending-display">
          <div className={`ending-banner ${ending.type}`}>
            <span className="ending-type-tag">
              {ending.type === "success" ? "成功" : "失败"}
            </span>
            <h2>{ending.title}</h2>
          </div>

          <div className="ending-text">
            {ending.endingText.split("\n").map((line, i) => (
              <p key={i} className="ending-line">{line}</p>
            ))}
          </div>

          {state.eventLog.length > 0 && (
            <details className="event-log-details">
              <summary>本局记录</summary>
              <div className="event-log">
                {state.eventLog.map((evt) => (
                  <div key={evt.id} className={`log-entry log-${evt.type}`}>
                    <span className="log-turn">[{evt.turn}]</span>
                    <span className="log-msg">{evt.message}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          <button className="btn btn-primary" onClick={handleRestart}>
            重新开始
          </button>
        </section>
      </div>
    );
  }

  // ---- 渲染：Dialogue 阶段 ----
  return (
    <div className="game-container">
      <header className="game-header">
        <h1>EDEN</h1>
        <span className="chapter-tag">Chapter 0 · 初次堕落</span>
      </header>

      {/* 顶部状态栏 */}
      <div className="status-bar">
        <div className="status-item turn-display">
          回合 <strong>{Math.min(state.turn, state.maxTurns)}</strong> / {state.maxTurns}
        </div>
        <div className="status-item progress-display">
          诱惑进度{" "}
          <span className="progress-bar">
            {[0, 1, 2, 3].map((level) => (
              <span
                key={level}
                className={`progress-dot ${
                  level <= state.temptationProgress ? "filled" : ""
                }`}
              />
            ))}
          </span>
        </div>
      </div>

      {/* 夏娃对白区 */}
      {eveReply && (
        <div className="eve-dialogue-box">
          <span className="speaker-label">夏娃</span>
          <p className="eve-dialogue-text">{eveReply}</p>
        </div>
      )}

      {/* 系统提示 */}
      {systemHint && (
        <div className="system-hint">{systemHint}</div>
      )}

      {/* 加载指示 */}
      {isLoading && (
        <div className="system-hint">夏娃在思考⋯⋯</div>
      )}

      {/* 推荐话术 */}
      {isPlaying && !isLoading && (
        <div className="suggestions-area">
          <span className="suggestions-label">可尝试说：</span>
          {suggestedInputs.slice(0, 2).map((text, i) => (
            <button
              key={i}
              className="btn btn-suggestion"
              onClick={() => handleSuggestedClick(text)}
            >
              「{text}」
            </button>
          ))}
        </div>
      )}

      {/* 输入区 */}
      {isPlaying && (
        <div className="input-area">
          <input
            ref={inputRef}
            className="player-input"
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
            className="btn btn-send"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? "⋯" : "发送"}
          </button>
        </div>
      )}

      {/* 事件日志 */}
      {state.eventLog.length > 0 && (
        <div className="event-log">
          {state.eventLog.map((evt) => (
            <div key={evt.id} className={`log-entry log-${evt.type}`}>
              <span className="log-turn">[{evt.turn}]</span>
              <span className="log-msg">{evt.message}</span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );
}
