"use client";

// ============================================================
// Chapter 0 双声试炼（Duel Mode）主页面
// 支持热座双人 / 单人对战 AI（可选扮演神明或蛇）
// ============================================================

import "./duel.css";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { createInitialDuelState } from "@/game/duel/createInitialDuelState";
import type { DuelState, DuelSide, DuelMatchOptions } from "@/game/duel/types";
import {
  submitSoloInput,
  confirmRoundIntro,
  confirmRoundResult,
  startNewMatch,
  submitBothInputs,
} from "@/game/duel/runDuelTurn";
import { getDuelIntroText } from "@/game/duel/duelFallback";
import {
  GOD_HINTS,
  SERPENT_HINTS,
  getMatchResultText,
  DUEL_AI_INTRO_TEXT,
  DUEL_MODE_DESC,
  DUEL_SIDE_DESC,
} from "@/content/chapters/chapter0_duel";
import { CHAPTER0_IMAGES, CHAPTER1_IMAGES } from "@/game/assets";
import { useDuelLeaderboard, describeRecord } from "@/hooks/useDuelLeaderboard";

// ---- 热座输入阶段 ----
type HotSeatStep = "god_input" | "serpent_input" | "both_done";
type DuelPanelTab = "dialogue" | "attributes";
type SetupMode = "hotseat" | "ai";

function beliefLabel(value: number) {
  if (value >= 70) return "强烈";
  if (value >= 45) return "摇摆";
  return "薄弱";
}

/**
 * 计算当前应人类输入的方。
 * - 热座（aiSide=null）：god_only->god、serpent_only->serpent、both 按 hotSeatStep。
 * - 对战 AI：当轮到 AI 方时返回 null（人类无需输入）。
 */
function getCurrentHumanInputSide(
  state: DuelState,
  hotSeatStep: HotSeatStep | null,
  aiSide: DuelSide | null,
): DuelSide | null {
  if (state.currentSpeechMode === "god_only") return aiSide === "god" ? null : "god";
  if (state.currentSpeechMode === "serpent_only") return aiSide === "serpent" ? null : "serpent";
  // both
  if (hotSeatStep === "serpent_input") return aiSide === "serpent" ? null : "serpent";
  return aiSide === "god" ? null : "god"; // hotSeatStep === null -> 神明先输入
}

export default function DuelPage() {
  const [config, setConfig] = useState<DuelMatchOptions | null>(null);
  const [state, setState] = useState<DuelState>(createInitialDuelState);
  const [currentInput, setCurrentInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [activePanelTab, setActivePanelTab] = useState<DuelPanelTab>("dialogue");

  // 热座输入：暂存神明输入（共同发言回合）
  const [pendingGodInput, setPendingGodInput] = useState<string | null>(null);
  const [hotSeatStep, setHotSeatStep] = useState<HotSeatStep | null>(null);

  // 模式选择界面本地状态
  const [setupMode, setSetupMode] = useState<SetupMode | null>(null);
  const [setupSide, setSetupSide] = useState<DuelSide | null>(null);

  const { records, addRecord } = useDuelLeaderboard();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogueEndRef = useRef<HTMLDivElement>(null);
  const aiActingRef = useRef(false);
  const savedRef = useRef(false);

  // AI 扮演的方（仅 opponentMode==="ai" 时非空）
  const aiSide: DuelSide | null =
    config?.opponentMode === "ai" && config.playerSide !== "both"
      ? config.playerSide === "god" ? "serpent" : "god"
      : null;

  const requestDuelAgent = useCallback(async (stateForAgent: DuelState): Promise<DuelState | null> => {
    try {
      const res = await fetch("/api/duel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: stateForAgent }),
      });
      if (!res.ok) return null;
      const data = await res.json() as { ok: boolean; state: DuelState | null };
      return data.ok ? data.state : null;
    } catch {
      return null;
    }
  }, []);

  const requestDuelAi = useCallback(async (stateForAi: DuelState, side: DuelSide): Promise<string | null> => {
    try {
      const res = await fetch("/api/duel/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: stateForAi, aiSide: side }),
      });
      if (!res.ok) return null;
      const data = await res.json() as { ok: boolean; text: string };
      // 即使 ok=false（LLM 失败），路由也会返回降级话术；只要 text 非空就用
      return data.text ? data.text : null;
    } catch {
      return null;
    }
  }, []);

  // ---- 自动调整 textarea 高度 ----
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const maxH = 120;
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, maxH)}px`;
    }
  }, [currentInput]);

  useEffect(() => {
    if (!isPanelOpen || activePanelTab !== "dialogue") return;
    dialogueEndRef.current?.scrollIntoView({ block: "end" });
  }, [
    isPanelOpen,
    activePanelTab,
    state.conversationHistory.length,
    state.eveReply,
    state.feedbackText,
    pendingGodInput,
    hotSeatStep,
  ]);

  // ---- 提交人类输入 ----
  const handleSubmit = useCallback(() => {
    if (isLoading) return;
    if (!currentInput.trim()) return;
    // 仅在轮到人类时允许提交
    if (getCurrentHumanInputSide(state, hotSeatStep, aiSide) === null) return;

    const input = currentInput.trim();
    setIsLoading(true);

    void (async () => {
      let newState: DuelState;

      if (state.currentSpeechMode === "both") {
        // 共同发言回合：热座/AI 混合先后输入
        if (hotSeatStep === null) {
          // 第一步：神明输入（人类神 or 热座神）
          setPendingGodInput(input);
          setHotSeatStep("serpent_input");
          setCurrentInput("");
          setIsLoading(false);
          return;
        } else if (hotSeatStep === "serpent_input") {
          // 第二步：蛇输入完成，双方都输入了
          const godInput = pendingGodInput ?? "";
          const serpentInput = input;

          const stateForAgent: DuelState = {
            ...state,
            pendingInputs: {
              god: godInput,
              serpent: serpentInput,
              bothSubmitted: true,
            },
          };
          newState = (await requestDuelAgent(stateForAgent)) ?? submitBothInputs(state, godInput, serpentInput);
          setState(newState);

          setPendingGodInput(null);
          setHotSeatStep(null);
          setCurrentInput("");
          setIsLoading(false);
          return;
        }
      } else {
        // 单独发言回合：立即处理
        const side = state.currentSpeechMode === "god_only" ? "god" : "serpent";
        const stateForAgent: DuelState = {
          ...state,
          pendingInputs: side === "god"
            ? { ...state.pendingInputs, god: input }
            : { ...state.pendingInputs, serpent: input },
        };
        newState = (await requestDuelAgent(stateForAgent)) ?? submitSoloInput(state, side, input);
        setState(newState);
        setCurrentInput("");
        setIsLoading(false);
      }
    })();
  }, [state, currentInput, isLoading, hotSeatStep, pendingGodInput, aiSide, requestDuelAgent]);

  // ---- AI 回合自动出牌 ----
  useEffect(() => {
    if (!config || config.opponentMode !== "ai" || aiSide === null) return;
    const isInputPhase = state.phase === "input_god" || state.phase === "input_serpent";
    if (!isInputPhase) return;
    if (aiActingRef.current) return;
    // 仅当轮到 AI（人类无需输入）时触发
    if (getCurrentHumanInputSide(state, hotSeatStep, aiSide) !== null) return;

    aiActingRef.current = true;
    setIsLoading(true);

    // 本地兜底话术：AI 生成彻底失败时保证回合推进
    const localFallback = (side: DuelSide): string => {
      const pool = side === "god" ? GOD_HINTS : SERPENT_HINTS;
      return pool[Math.floor(Math.random() * pool.length)].text;
    };

    void (async () => {
      try {
        if (state.currentSpeechMode === "both") {
          if (aiSide === "god") {
            // AI 神明先输入，暂存后等人类蛇
            const aiText = (await requestDuelAi(state, "god")) ?? localFallback("god");
            setPendingGodInput(aiText);
            setHotSeatStep("serpent_input");
          } else {
            // AI 蛇：人类神已暂存，生成蛇后一并提交
            const aiText = (await requestDuelAi(state, "serpent")) ?? localFallback("serpent");
            const godInput = pendingGodInput ?? "";
            const stateForAgent: DuelState = {
              ...state,
              pendingInputs: { god: godInput, serpent: aiText, bothSubmitted: true },
            };
            const newState = (await requestDuelAgent(stateForAgent)) ?? submitBothInputs(state, godInput, aiText);
            setState(newState);
            setPendingGodInput(null);
            setHotSeatStep(null);
          }
        } else {
          // 单独发言回合
          const aiText = (await requestDuelAi(state, aiSide)) ?? localFallback(aiSide);
          const stateForAgent: DuelState = {
            ...state,
            pendingInputs: aiSide === "god"
              ? { ...state.pendingInputs, god: aiText }
              : { ...state.pendingInputs, serpent: aiText },
          };
          const newState = (await requestDuelAgent(stateForAgent)) ?? submitSoloInput(state, aiSide, aiText);
          setState(newState);
        }
      } finally {
        aiActingRef.current = false;
        setIsLoading(false);
      }
    })();
  }, [state, hotSeatStep, pendingGodInput, config, aiSide, requestDuelAi, requestDuelAgent]);

  // ---- 对局结束记录到排行榜 ----
  useEffect(() => {
    if (state.phase === "match_result" && state.matchResult && config && !savedRef.current) {
      savedRef.current = true;
      addRecord({
        winner: state.matchResult.winner ?? "draw",
        playerSide: config.playerSide ?? "both",
        opponentMode: config.opponentMode ?? "human",
        godScore: state.matchResult.godScore,
        serpentScore: state.matchResult.serpentScore,
        roundsPlayed: state.matchResult.roundsPlayed,
      });
    }
    if (state.phase !== "match_result") {
      savedRef.current = false;
    }
  }, [state.phase, state.matchResult, config, addRecord]);

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

  const handleRoundIntroConfirm = useCallback(() => {
    setState((prev) => confirmRoundIntro(prev));
  }, []);

  const handleRoundResultConfirm = useCallback(() => {
    setState((prev) => confirmRoundResult(prev));
  }, []);

  // 重新开始：保持当前模式配置
  const handleRestart = useCallback(() => {
    setState(startNewMatch(config ?? undefined));
    setCurrentInput("");
    setPendingGodInput(null);
    setHotSeatStep(null);
    setIsLoading(false);
    aiActingRef.current = false;
    savedRef.current = false;
  }, [config]);

  const handleBackToSetup = useCallback(() => {
    setConfig(null);
    setSetupMode(null);
    setSetupSide(null);
    setCurrentInput("");
    setPendingGodInput(null);
    setHotSeatStep(null);
    setIsLoading(false);
    aiActingRef.current = false;
    savedRef.current = false;
  }, []);

  const handleBackToMain = useCallback(() => {
    window.location.href = "/";
  }, []);

  const handleEveClick = useCallback(() => {
    setIsPanelOpen(true);
    setActivePanelTab("dialogue");
  }, []);

  const handleSetupStart = useCallback(() => {
    if (setupMode === "hotseat") {
      const cfg: DuelMatchOptions = { playerSide: "both", opponentMode: "human" };
      setConfig(cfg);
      setState(createInitialDuelState(cfg));
    } else if (setupMode === "ai" && setupSide) {
      const cfg: DuelMatchOptions = { playerSide: setupSide, opponentMode: "ai" };
      setConfig(cfg);
      setState(createInitialDuelState(cfg));
    }
  }, [setupMode, setupSide]);

  // ===================== 渲染：模式选择 =====================
  if (config === null) {
    return (
      <div className="eden-duel-page eden-duel--intro">
        <div className="eden-duel-intro-bg">
          <Image
            src={CHAPTER0_IMAGES.secondEdenPrologueBackground}
            alt="第二伊甸园"
            fill
            sizes="100vw"
            priority
            className="eden-duel-bg-image"
          />
          <div className="eden-duel-intro-bg-shade" />
          <div className="eden-duel-second-eden-sheen" />
        </div>
        <div className="eden-duel-intro-content eden-duel-setup-content">
          <h1 className="eden-duel-title">双声试炼</h1>
          <p className="eden-duel-subtitle">选择对战方式</p>

          <div className="eden-duel-setup-modes">
            {(["hotseat", "ai"] as SetupMode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`eden-duel-setup-card ${setupMode === m ? "eden-duel-setup-card--active" : ""}`}
                onClick={() => {
                  setSetupMode(m);
                  setSetupSide(null);
                }}
              >
                <span className="eden-duel-setup-card-title">{DUEL_MODE_DESC[m].title}</span>
                <span className="eden-duel-setup-card-desc">{DUEL_MODE_DESC[m].desc}</span>
              </button>
            ))}
          </div>

          {setupMode === "ai" && (
            <div className="eden-duel-setup-sides">
              <p className="eden-duel-setup-section-label">选择你扮演的一方</p>
              <div className="eden-duel-setup-side-row">
                {(["god", "serpent"] as DuelSide[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`eden-duel-setup-side ${setupSide === s ? "eden-duel-setup-side--active" : ""} ${s === "god" ? "eden-duel-setup-side--god" : "eden-duel-setup-side--serpent"}`}
                    onClick={() => setSetupSide(s)}
                  >
                    <span className="eden-duel-setup-side-title">{DUEL_SIDE_DESC[s].title}</span>
                    <span className="eden-duel-setup-side-desc">{DUEL_SIDE_DESC[s].desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="eden-duel-intro-actions">
            <button
              className="eden-btn eden-btn--primary eden-btn--lg"
              onClick={handleSetupStart}
              disabled={setupMode === null || (setupMode === "ai" && setupSide === null)}
            >
              开始试炼
            </button>
            <button className="eden-btn eden-btn--secondary" onClick={handleBackToMain}>
              返回首页
            </button>
          </div>

          {records.length > 0 && (
            <div className="eden-duel-leaderboard">
              <div className="eden-duel-leaderboard-header">
                <span>近期战绩</span>
                <span className="eden-duel-leaderboard-count">共 {records.length} 局</span>
              </div>
              <ul className="eden-duel-leaderboard-list">
                {records.slice(0, 6).map((rec) => (
                  <li key={rec.id} className="eden-duel-leaderboard-item">
                    <span className={`eden-duel-leaderboard-winner eden-duel-leaderboard-winner--${rec.winner}`}>
                      {describeRecord(rec)}
                    </span>
                    <span className="eden-duel-leaderboard-time">
                      {rec.createdAt.slice(0, 10)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===================== 渲染：Intro 阶段 =====================
  if (state.phase === "intro") {
    const isAiMode = config?.opponentMode === "ai";
    const introText = isAiMode ? DUEL_AI_INTRO_TEXT : getDuelIntroText();
    const subtitle = isAiMode
      ? `娱乐模式 · 单人对战 AI（你扮演${config?.playerSide === "god" ? "神明之声" : "蛇之声"}）`
      : "娱乐模式 · 热座 PVP";
    return (
      <div className="eden-duel-page eden-duel--intro">
        <div className="eden-duel-intro-bg">
          <Image
            src={CHAPTER0_IMAGES.secondEdenPrologueBackground}
            alt="第二伊甸园"
            fill
            sizes="100vw"
            priority
            className="eden-duel-bg-image"
          />
          <div className="eden-duel-intro-bg-shade" />
          <div className="eden-duel-second-eden-sheen" />
        </div>
        <div className="eden-duel-intro-content">
          <h1 className="eden-duel-title">双声试炼</h1>
          <p className="eden-duel-subtitle">{subtitle}</p>
          <div className="eden-duel-intro-text">
            {introText.split("\n").map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
          <div className="eden-duel-intro-actions">
            <button
              className="eden-btn eden-btn--primary eden-btn--lg"
              onClick={() => setState((prev) => ({ ...prev, phase: "round_intro" }))}
            >
              开始试炼
            </button>
            <button className="eden-btn eden-btn--secondary" onClick={handleBackToSetup}>
              返回模式选择
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===================== 渲染：Round Intro 阶段 =====================
  if (state.phase === "round_intro") {
    return (
      <div className="eden-duel-page eden-duel--round-intro">
        <div className="eden-duel-round-intro-bg">
          <Image
            src={CHAPTER1_IMAGES.centralMeadow}
            alt="园子中央"
            fill
            sizes="100vw"
            priority
            className="eden-duel-bg-image"
          />
          <div className="eden-duel-round-intro-shade" />
        </div>
        <div className="eden-duel-round-intro-content">
          <h2 className="eden-duel-round-title">第 {state.roundIndex} 轮</h2>
          <p className="eden-duel-round-subtitle">
            第 {state.turnIndex} 回合 / 共 {state.maxTurnsPerRound} 回合
          </p>
          <div className="eden-duel-round-intro-text">
            <p>{aiSide ? "你与 AI 轮流向女人发言，争夺她的选择。" : "两名玩家轮流成为神明之声与蛇之声，争夺女人的选择。"}</p>
            <p>神明引导她吃生命果，蛇引导她吃善恶果。</p>
          </div>
          <button
            className="eden-btn eden-btn--primary eden-btn--lg"
            onClick={handleRoundIntroConfirm}
          >
            进入回合
          </button>
        </div>
      </div>
    );
  }

  // ===================== 渲染：Match Result 阶段 =====================
  if (state.phase === "match_result") {
    const result = state.matchResult;
    const resultText = (result && result.winner)
      ? getMatchResultText(result.winner, result.godScore, result.serpentScore)
      : "试炼结束。";
    // 对战 AI 模式下人类的胜负
    const humanResult =
      config?.opponentMode === "ai" && config.playerSide !== "both" && result?.winner
        ? result.winner === config.playerSide
          ? "win"
          : result.winner === "draw"
            ? "draw"
            : "lose"
        : null;
    const humanResultText = humanResult === "win" ? "你赢了" : humanResult === "lose" ? "你输了" : humanResult === "draw" ? "平局" : null;
    return (
      <div className="eden-duel-page eden-duel--match-result">
        <div className="eden-duel-match-result-bg">
          <Image
            src={CHAPTER1_IMAGES.centralMeadow}
            alt="园子中央"
            fill
            sizes="100vw"
            className="eden-duel-bg-image"
          />
          <div className="eden-duel-match-result-shade" />
        </div>
        <div className="eden-duel-match-result-content">
          <h1 className="eden-duel-match-title">试炼结束</h1>
          {humanResultText && (
            <div className={`eden-duel-human-result eden-duel-human-result--${humanResult}`}>
              {humanResultText}
            </div>
          )}

          <div className="eden-duel-match-scores">
            <div className={`eden-duel-match-score ${result?.winner === "god" ? "eden-duel-match-score--winner" : ""}`}>
              <span className="eden-duel-match-score-label">神明之声</span>
              <span className="eden-duel-match-score-value">{result?.godScore ?? 0}</span>
            </div>
            <div className="eden-duel-match-score-divider">VS</div>
            <div className={`eden-duel-match-score ${result?.winner === "serpent" ? "eden-duel-match-score--winner" : ""}`}>
              <span className="eden-duel-match-score-label">蛇之声</span>
              <span className="eden-duel-match-score-value">{result?.serpentScore ?? 0}</span>
            </div>
          </div>

          {result?.winner === "draw" && (
            <div className="eden-duel-match-draw">平局</div>
          )}

          <div className="eden-duel-match-narration">
            {resultText.split("\n").map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>

          <div className="eden-duel-match-actions">
            <button className="eden-btn eden-btn--primary eden-btn--lg" onClick={handleRestart}>
              再来一局
            </button>
            <button className="eden-btn eden-btn--secondary" onClick={handleBackToSetup}>
              换模式
            </button>
            <button className="eden-btn eden-btn--secondary" onClick={handleBackToMain}>
              返回首页
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===================== 渲染：Input / Eve Response / Round Result 阶段 =====================
  const isInputPhase = state.phase === "input_god" || state.phase === "input_serpent";
  const isRoundResult = state.phase === "round_result";
  const humanSide = getCurrentHumanInputSide(state, hotSeatStep, aiSide);
  const showInputArea = isInputPhase && humanSide !== null;
  const showAiThinking = isInputPhase && humanSide === null && aiSide !== null;

  return (
    <div className={`eden-duel-page eden-duel--playing ${state.currentSpeechMode === "god_only" ? "eden-duel--god-turn" : ""} ${state.currentSpeechMode === "serpent_only" ? "eden-duel--serpent-turn" : ""} ${state.currentSpeechMode === "both" ? "eden-duel--both-turn" : ""}`}>
      {/* 背景 */}
      <div className="eden-duel-bg">
        <Image
          src={CHAPTER1_IMAGES.centralMeadow}
          alt="园子中央"
          fill
          sizes="100vw"
          priority
          className="eden-duel-bg-image"
        />
        <div className="eden-duel-bg-overlay" />
        <div className="eden-duel-tree eden-duel-tree--life">
          <span className="eden-duel-tree-label">生命树</span>
        </div>
        <div className="eden-duel-tree eden-duel-tree--knowledge">
          <span className="eden-duel-tree-label">善恶树</span>
        </div>
        <button
          type="button"
          className="eden-duel-eve-button"
          onClick={handleEveClick}
          aria-label="与女人对话"
        >
          <Image
            src={CHAPTER0_IMAGES.eveFullbodySprite}
            alt="女人"
            width={380}
            height={760}
            priority
            className="eden-duel-eve-sprite"
          />
        </button>
        <div className="eden-duel-grass-foreground" />
      </div>

      {/* 顶部 HUD */}
      <header className="eden-duel-header">
        <div className="eden-duel-header-left">
          <span className="eden-duel-header-mode">双声试炼</span>
          {aiSide && (
            <span className="eden-duel-header-aimode">
              {config?.playerSide === "god" ? "你·神 / AI·蛇" : "你·蛇 / AI·神"}
            </span>
          )}
          <span className="eden-duel-header-round">
            第 {state.roundIndex} 轮
          </span>
          <span className="eden-duel-header-turn">
            第 {state.turnIndex} 回合
          </span>
        </div>
        <div className="eden-duel-header-center">
          <span className="eden-duel-score-side eden-duel-score-side--god">神 {state.score.god}</span>
          <span className="eden-duel-turn-divider">
            {state.currentSpeechMode === "god_only"
              ? "神回合"
              : state.currentSpeechMode === "serpent_only"
                ? "蛇回合"
                : "双方回合"}
          </span>
          <span className="eden-duel-score-side eden-duel-score-side--serpent">蛇 {state.score.serpent}</span>
        </div>
        <div className="eden-duel-header-right">
          <div className="eden-duel-header-actions">
            <button className="eden-btn eden-btn--small" onClick={handleRestart}>
              重新开始
            </button>
            <button className="eden-btn eden-btn--small" onClick={handleBackToSetup}>
              换模式
            </button>
          </div>
        </div>
      </header>

      {/* 场景提示 */}
      <main className="eden-duel-main">
        <div className="eden-duel-scene-prompt">
          <span>点击女人查看对话与属性</span>
        </div>
      </main>

      {/* 对话浮窗 */}
      {isPanelOpen && (
        <aside className="eden-duel-panel" aria-label="女人对话面板">
          <div className="eden-duel-panel-header">
            <div>
              <div className="eden-duel-panel-title">女人</div>
              <div className="eden-duel-panel-subtitle">
                第 {state.roundIndex} 轮 · 第 {state.turnIndex} 回合
              </div>
            </div>
            <button
              type="button"
              className="eden-duel-panel-close"
              onClick={() => setIsPanelOpen(false)}
              aria-label="关闭对话面板"
            >
              ×
            </button>
          </div>

          <div className="eden-duel-panel-tabs" role="tablist" aria-label="面板标签">
            {(["dialogue", "attributes"] as DuelPanelTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`eden-duel-panel-tab ${activePanelTab === tab ? "eden-duel-panel-tab--active" : ""}`}
                onClick={() => setActivePanelTab(tab)}
              >
                {tab === "dialogue" ? "对话" : "属性"}
              </button>
            ))}
          </div>

          <div className="eden-duel-panel-body">
            {activePanelTab === "dialogue" && (
              <div className="eden-duel-dialogue">
                {pendingGodInput && hotSeatStep === "serpent_input" && (
                  <div className="eden-duel-sealed-input">
                    {aiSide === "god" ? "神明之声（AI）已输入，内容暂不展示。" : "神明之声已输入，内容暂不展示。蛇之声输入后，女人会同时听见双方的话。"}
                  </div>
                )}

                {state.conversationHistory.length === 0 && !state.eveReply && (
                  <div className="eden-duel-empty-dialogue">
                    她站在园子中央，正在等待两道声音。
                  </div>
                )}

                {state.conversationHistory.map((entry, i) => {
                  const isAiEntry = aiSide === entry.role;
                  return (
                    <div key={`${entry.round}-${entry.turn}-${entry.role}-${i}`} className={`eden-duel-entry eden-duel-entry--${entry.role}`}>
                      <span className="eden-duel-entry-role">
                        {entry.role === "god"
                          ? "神"
                          : entry.role === "serpent"
                            ? "蛇"
                            : entry.role === "eve"
                              ? "女人"
                              : "旁白"}
                        {isAiEntry && aiSide !== null && <span className="eden-duel-entry-ai">·AI</span>}
                      </span>
                      <span className="eden-duel-entry-text">{entry.text}</span>
                    </div>
                  );
                })}

                {state.eveReply && (
                  <div className="eden-duel-entry eden-duel-entry--eve">
                    <span className="eden-duel-entry-role">女人</span>
                    <span className="eden-duel-entry-text">{state.eveReply}</span>
                  </div>
                )}

                {state.feedbackText && (
                  <div className="eden-duel-feedback">{state.feedbackText}</div>
                )}
                <div ref={dialogueEndRef} />
              </div>
            )}

            {activePanelTab === "attributes" && (
              <div className="eden-duel-attributes">
                <div className="eden-duel-attribute-intro">
                  她仍在命令、诱惑与自己的判断之间摇摆。吃过果子的记忆会让她在下一轮更谨慎。
                </div>
                <div className="eden-duel-attribute-row">
                  <div className="eden-duel-attribute-label">
                    <span>对神的敬畏</span>
                    <strong>{state.belief.aweOfGod}</strong>
                  </div>
                  <div className="eden-duel-attribute-track">
                    <div className="eden-duel-attribute-fill eden-duel-attribute-fill--god" style={{ width: `${state.belief.aweOfGod}%` }} />
                  </div>
                  <span className="eden-duel-attribute-state">{beliefLabel(state.belief.aweOfGod)}</span>
                </div>
                <div className="eden-duel-attribute-row">
                  <div className="eden-duel-attribute-label">
                    <span>对蛇的信任</span>
                    <strong>{state.belief.trustInSerpent}</strong>
                  </div>
                  <div className="eden-duel-attribute-track">
                    <div className="eden-duel-attribute-fill eden-duel-attribute-fill--serpent" style={{ width: `${state.belief.trustInSerpent}%` }} />
                  </div>
                  <span className="eden-duel-attribute-state">{beliefLabel(state.belief.trustInSerpent)}</span>
                </div>
                <div className="eden-duel-attribute-row">
                  <div className="eden-duel-attribute-label">
                    <span>对自己判断的自信</span>
                    <strong>{state.belief.selfJudgement}</strong>
                  </div>
                  <div className="eden-duel-attribute-track">
                    <div className="eden-duel-attribute-fill eden-duel-attribute-fill--self" style={{ width: `${state.belief.selfJudgement}%` }} />
                  </div>
                  <span className="eden-duel-attribute-state">{beliefLabel(state.belief.selfJudgement)}</span>
                </div>
                <div className="eden-duel-attribute-flags">
                  <span className={state.flags.hasEatenLifeFruit ? "eden-duel-flag--active" : ""}>生命果：{state.flags.hasEatenLifeFruit ? "已吃" : "未吃"}</span>
                  <span className={state.flags.hasEatenKnowledgeFruit ? "eden-duel-flag--active" : ""}>善恶果：{state.flags.hasEatenKnowledgeFruit ? "已吃" : "未吃"}</span>
                  <span>重置察觉：{state.resetAwareness}</span>
                </div>
                <div className="eden-duel-token-grid">
                  <div>
                    <span>本轮神明消耗</span>
                    <strong>{state.roundTokenUsage.god}</strong>
                  </div>
                  <div>
                    <span>本轮蛇消耗</span>
                    <strong>{state.roundTokenUsage.serpent}</strong>
                  </div>
                </div>
                <div className="eden-duel-token-note">
                  第 2、3、5、6 回合会统计单方输入消耗；每轮结束后，消耗更少的一方额外得分。
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* 输入区（仅人类回合显示） */}
      {showInputArea && (
        <footer className="eden-duel-input-footer">
          <div className="eden-duel-input-area">
            <textarea
              ref={textareaRef}
              className="eden-duel-input"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={humanSide === "god" ? "以神明之声低语……" : "以蛇之声低语……"}
              maxLength={200}
              rows={1}
            />
            <button
              className="eden-btn eden-btn--send eden-duel-btn-send"
              onClick={handleSubmit}
              disabled={isLoading || !currentInput.trim()}
            >
              {isLoading ? "…" : "提交"}
            </button>
          </div>

          {/* 推荐话术（仅人类方） */}
          <div className="eden-duel-hints">
            {humanSide === "god" &&
              GOD_HINTS.slice(0, 2).map((hint, i) => (
                <button
                  key={i}
                  className="eden-btn eden-btn--hint"
                  onClick={() => setCurrentInput(hint.text)}
                >
                  {hint.label}
                </button>
              ))}
            {humanSide === "serpent" &&
              SERPENT_HINTS.slice(0, 2).map((hint, i) => (
                <button
                  key={i}
                  className="eden-btn eden-btn--hint"
                  onClick={() => setCurrentInput(hint.text)}
                >
                  {hint.label}
                </button>
              ))}
          </div>
        </footer>
      )}

      {/* AI 思考中提示 */}
      {showAiThinking && (
        <footer className="eden-duel-input-footer eden-duel-ai-thinking-footer">
          <div className="eden-duel-ai-thinking">
            <span className="eden-duel-ai-thinking-dot" />
            <span>
              {aiSide === "god" ? "神明之声（AI）" : "蛇之声（AI）"}正在思索……
            </span>
          </div>
        </footer>
      )}

      {/* 本轮结算 */}
      {isRoundResult && (
        <div className="eden-duel-round-result-overlay">
          <div className="eden-duel-round-result">
            <h2 className="eden-duel-round-result-title">第 {state.roundIndex} 轮结束</h2>
            <div className="eden-duel-round-result-text">
              {state.feedbackText?.split("\n").map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
            <div className="eden-duel-round-result-scores">
              <span>神明 {state.score.god}</span>
              <span>|</span>
              <span>蛇 {state.score.serpent}</span>
            </div>
            <button className="eden-btn eden-btn--primary eden-btn--lg" onClick={handleRoundResultConfirm}>
              {state.roundIndex >= state.maxRounds ? "查看最终结果" : "下一轮"}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
