// ============================================================
// Chapter 0 音频反馈 Hook
// Phase 5 + Phase 8 优化：支持 intro BGM + 淡入淡出
//
// 触发规则：
// - genesis_creation_bgm.mp3：intro 阶段循环播放
// - eden_ambient_loop.mp3：dialogue 阶段循环播放
// - whisper_submit.mp3：玩家有效发送时播放
// - temptation_progress.mp3：诱惑进度增加时播放
// - fruit_taken.mp3：endingId === "eve_eats_fruit" 时播放一次
// - god_arrives.mp3：endingId === "god_arrives" 时播放一次
//
// 容错：
// - 音频缺失时 console.warn，不报错
// - 浏览器阻止播放时不报错
// - 全部 client side，无 SSR/hydration 问题
// ============================================================

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ---- 音频路径常量 ----
const AUDIO_BASE = "/assets/chapter0/audio";

const AUDIO_PATHS = {
  genesisCreationBgm: `${AUDIO_BASE}/genesis_creation_bgm.mp3`,
  edenAmbient: `${AUDIO_BASE}/eden_ambient_loop.mp3`,
  whisperSubmit: `${AUDIO_BASE}/whisper_submit.mp3`,
  temptationProgress: `${AUDIO_BASE}/temptation_progress.mp3`,
  fruitTaken: `${AUDIO_BASE}/fruit_taken.mp3`,
  godArrives: `${AUDIO_BASE}/god_arrives.mp3`,
} as const;

// ---- 游戏阶段 ----
type GamePhase = "intro" | "dialogue" | "tool_resolution" | "ending";

// ---- 安全播放辅助 ----
function safePlay(audio: HTMLAudioElement | null): Promise<boolean> {
  if (!audio) return Promise.resolve(false);
  try {
    const promise = audio.play();
    if (promise && typeof promise.then === "function") {
      return promise
        .then(() => true)
        .catch(() => false);
    }
    return Promise.resolve(true);
  } catch {
    return Promise.resolve(false);
  }
}

function safePause(audio: HTMLAudioElement | null): void {
  if (!audio) return;
  try {
    audio.pause();
  } catch {
    // 暂停失败，静默忽略
  }
}

function createAudioElement(src: string): HTMLAudioElement | null {
  try {
    const audio = new Audio(src);
    audio.preload = "auto";
    return audio;
  } catch {
    console.warn(`[Audio] Failed to create audio element: ${src}`);
    return null;
  }
}

// ---- 淡出音频 ----
function fadeOutAudio(
  audio: HTMLAudioElement | null,
  durationMs: number = 1000,
): void {
  if (!audio) return;
  const startVolume = audio.volume;
  const steps = 20;
  const stepTime = durationMs / steps;
  const volumeStep = startVolume / steps;
  let currentStep = 0;

  const timer = setInterval(() => {
    currentStep++;
    const newVolume = Math.max(0, startVolume - volumeStep * currentStep);
    try {
      audio.volume = newVolume;
    } catch {
      clearInterval(timer);
    }
    if (currentStep >= steps) {
      clearInterval(timer);
      safePause(audio);
      try {
        audio.volume = startVolume; // 重置音量以备下次使用
      } catch {
        // 忽略
      }
    }
  }, stepTime);
}

// ---- Hook 参数 ----
export type UseChapter0AudioParams = {
  /** 当前诱惑进度 */
  temptationProgress: number;
  /** 当前结局 ID */
  endingId: string | null;
  /** 当前游戏阶段 */
  phase: GamePhase;
  /** 是否允许在 dialogue 阶段启动 Chapter 0 环境音，默认 true。
   *  WorldPage（第一章探索）应传 false，避免与 useChapter1Audio 的环境音重叠。 */
  enableDialogueAmbient?: boolean;
};

// ---- Hook 返回 ----
export type UseChapter0AudioReturn = {
  /** 声音是否开启 */
  soundEnabled: boolean;
  /** 切换声音开关 */
  toggleSound: () => void;
  /** 播放发送音效（有效发送时调用） */
  playWhisperSubmit: () => void;
  /** 播放进度音效（进度增加时由组件内自动调用） */
  playTemptationProgress: () => void;
  /** 用户手势后重试播放 intro BGM */
  retryIntroBgm: () => void;
  /** 播放吃果音效（成功结局过场 Beat 1 调用） */
  playFruitTaken: () => void;
  /** 播放上帝降临音效（成功结局过场 Beat 4/5 或失败结局调用） */
  playGodArrives: () => void;
};

export function useChapter0Audio({
  temptationProgress,
  endingId,
  phase,
  enableDialogueAmbient = true,
}: UseChapter0AudioParams): UseChapter0AudioReturn {
  const [soundEnabled, setSoundEnabled] = useState(true);

  // 音频引用
  const introBgmRef = useRef<HTMLAudioElement | null>(null);
  const ambientRef = useRef<HTMLAudioElement | null>(null);
  const whisperRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLAudioElement | null>(null);
  const fruitRef = useRef<HTMLAudioElement | null>(null);
  const godRef = useRef<HTMLAudioElement | null>(null);

  // 追踪状态变化，防止重复播放
  const prevProgressRef = useRef(temptationProgress);
  const endingPlayedRef = useRef<string | null>(null);
  // intro BGM 是否真正在播放中（play() resolve 后才为 true）
  const introBgmActuallyPlayingRef = useRef(false);
  const ambientActuallyPlayingRef = useRef(false);
  const prevPhaseRef = useRef<GamePhase>(phase);

  // 成功结局后段 god_arrives 延迟播放 timer（useRef 持有，便于 cleanup 清理）
  // soundEnabled 的最新值镜像，供延迟回调二次确认
  const soundEnabledRef = useRef(soundEnabled);

  // 保持 soundEnabledRef 与 soundEnabled 同步
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // ---- 初始化音频元素（client side only） ----
  useEffect(() => {
    introBgmRef.current = createAudioElement(AUDIO_PATHS.genesisCreationBgm);
    if (introBgmRef.current) {
      introBgmRef.current.loop = true;
      introBgmRef.current.volume = 0.18;
    }

    ambientRef.current = createAudioElement(AUDIO_PATHS.edenAmbient);
    if (ambientRef.current) {
      ambientRef.current.loop = true;
      ambientRef.current.volume = 0.15;
    }

    whisperRef.current = createAudioElement(AUDIO_PATHS.whisperSubmit);
    if (whisperRef.current) {
      whisperRef.current.volume = 0.4;
    }

    progressRef.current = createAudioElement(AUDIO_PATHS.temptationProgress);
    if (progressRef.current) {
      progressRef.current.volume = 0.5;
    }

    fruitRef.current = createAudioElement(AUDIO_PATHS.fruitTaken);
    if (fruitRef.current) {
      fruitRef.current.volume = 0.6;
    }

    godRef.current = createAudioElement(AUDIO_PATHS.godArrives);
    if (godRef.current) {
      godRef.current.volume = 0.6;
    }

    return () => {
      safePause(introBgmRef.current);
      safePause(ambientRef.current);
      safePause(whisperRef.current);
      safePause(progressRef.current);
      safePause(fruitRef.current);
      safePause(godRef.current);
    };
  }, []);

  // ---- 阶段切换处理 ----
  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = phase;

    if (!soundEnabled) return;

    // intro → dialogue：淡出 intro BGM，启动 ambient（仅当允许）
    if (prevPhase === "intro" && (phase === "dialogue" || phase === "tool_resolution")) {
      fadeOutAudio(introBgmRef.current, 1000);
      introBgmActuallyPlayingRef.current = false;
      if (enableDialogueAmbient && !ambientActuallyPlayingRef.current) {
        safePlay(ambientRef.current).then((ok) => {
          if (ok) ambientActuallyPlayingRef.current = true;
        });
      }
      return;
    }

    // 仍在 intro 阶段，尝试播放 intro BGM
    if (phase === "intro" && !introBgmActuallyPlayingRef.current) {
      safePlay(introBgmRef.current).then((ok) => {
        if (ok) introBgmActuallyPlayingRef.current = true;
      });
      return;
    }

    // dialogue 阶段，播放 ambient（仅当允许）
    if (
      enableDialogueAmbient &&
      (phase === "dialogue" || phase === "tool_resolution") &&
      !ambientActuallyPlayingRef.current
    ) {
      safePlay(ambientRef.current).then((ok) => {
        if (ok) ambientActuallyPlayingRef.current = true;
      });
    }
  }, [phase, soundEnabled, enableDialogueAmbient]);

  // ---- 声音开关 ----
  useEffect(() => {
    if (soundEnabled) {
      if (phase === "intro") {
        // intro 阶段开启声音：无论是否已播放过，都尝试播放
        safePlay(introBgmRef.current).then((ok) => {
          if (ok) introBgmActuallyPlayingRef.current = true;
        });
      }
      if (
        enableDialogueAmbient &&
        (phase === "dialogue" || phase === "tool_resolution") &&
        ambientActuallyPlayingRef.current
      ) {
        safePlay(ambientRef.current);
      }
    } else {
      safePause(introBgmRef.current);
      safePause(ambientRef.current);
    }
  }, [soundEnabled, phase, enableDialogueAmbient]);

  // ---- 进度音效：temptationProgress 增加时 ----
  useEffect(() => {
    if (temptationProgress > prevProgressRef.current && soundEnabled) {
      safePlay(progressRef.current);
    }
    prevProgressRef.current = temptationProgress;
  }, [temptationProgress, soundEnabled]);

  // ---- 结局音效 ----
  useEffect(() => {
    if (!endingId || !soundEnabled) return;
    if (endingPlayedRef.current === endingId) return;

    endingPlayedRef.current = endingId;

    // 结局时停止所有背景音
    safePause(introBgmRef.current);
    introBgmActuallyPlayingRef.current = false;
    safePause(ambientRef.current);
    ambientActuallyPlayingRef.current = false;

    // 失败结局：直接播放上帝降临音效
    // 成功结局的音效由剧情过场（cinematic）按 Beat 驱动，见 playFruitTaken / playGodArrives
    if (endingId === "god_arrives") {
      safePlay(godRef.current);
    }
  }, [endingId, soundEnabled]);

  // ---- 切换声音 ----
  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => !prev);
  }, []);

  // ---- 播放发送音效 ----
  const playWhisperSubmit = useCallback(() => {
    if (soundEnabled) {
      safePlay(whisperRef.current);
    }
  }, [soundEnabled]);

  // ---- 播放进度音效（手动触发，用于即时反馈） ----
  const playTemptationProgress = useCallback(() => {
    if (soundEnabled) {
      safePlay(progressRef.current);
    }
  }, [soundEnabled]);

  // ---- 用户手势后重试 intro BGM ----
  const retryIntroBgm = useCallback(() => {
    if (phase === "intro" && soundEnabled && !introBgmActuallyPlayingRef.current) {
      safePlay(introBgmRef.current).then((ok) => {
        if (ok) introBgmActuallyPlayingRef.current = true;
      });
    }
  }, [phase, soundEnabled]);

  // ---- 播放吃果音效（成功结局过场 Beat 1） ----
  const playFruitTaken = useCallback(() => {
    // 使用 ref 镜像，避免回调因 soundEnabled 变化而频繁重建
    if (soundEnabledRef.current) {
      safePlay(fruitRef.current);
    }
  }, []);

  // ---- 播放上帝降临音效（成功结局过场 Beat 4/5） ----
  const playGodArrives = useCallback(() => {
    if (soundEnabledRef.current) {
      safePlay(godRef.current);
    }
  }, []);

  return {
    soundEnabled,
    toggleSound,
    playWhisperSubmit,
    playTemptationProgress,
    retryIntroBgm,
    playFruitTaken,
    playGodArrives,
  };
}
