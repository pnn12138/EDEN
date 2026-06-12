// ============================================================
// Chapter 0 音频反馈 Hook
// Phase 5：最小 UI 与素材包装
//
// 触发规则：
// - eden_ambient_loop.mp3：首次交互后循环播放背景音
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
  edenAmbient: `${AUDIO_BASE}/eden_ambient_loop.mp3`,
  whisperSubmit: `${AUDIO_BASE}/whisper_submit.mp3`,
  temptationProgress: `${AUDIO_BASE}/temptation_progress.mp3`,
  fruitTaken: `${AUDIO_BASE}/fruit_taken.mp3`,
  godArrives: `${AUDIO_BASE}/god_arrives.mp3`,
} as const;

// ---- 安全播放辅助 ----
function safePlay(audio: HTMLAudioElement | null): void {
  if (!audio) return;
  try {
    const promise = audio.play();
    if (promise && typeof promise.catch === "function") {
      promise.catch(() => {
        // 浏览器阻止自动播放，静默忽略
      });
    }
  } catch {
    // 播放失败，静默忽略
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

// ---- Hook 参数 ----
export type UseChapter0AudioParams = {
  /** 当前诱惑进度 */
  temptationProgress: number;
  /** 当前结局 ID */
  endingId: string | null;
  /** 是否已开始对话 */
  isDialogueStarted: boolean;
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
};

export function useChapter0Audio({
  temptationProgress,
  endingId,
  isDialogueStarted,
}: UseChapter0AudioParams): UseChapter0AudioReturn {
  const [soundEnabled, setSoundEnabled] = useState(true);

  // 音频引用
  const ambientRef = useRef<HTMLAudioElement | null>(null);
  const whisperRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLAudioElement | null>(null);
  const fruitRef = useRef<HTMLAudioElement | null>(null);
  const godRef = useRef<HTMLAudioElement | null>(null);

  // 追踪状态变化，防止重复播放
  const prevProgressRef = useRef(temptationProgress);
  const endingPlayedRef = useRef<string | null>(null);
  const ambientStartedRef = useRef(false);

  // ---- 初始化音频元素（client side only） ----
  useEffect(() => {
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
      safePause(ambientRef.current);
      safePause(whisperRef.current);
      safePause(progressRef.current);
      safePause(fruitRef.current);
      safePause(godRef.current);
    };
  }, []);

  // ---- 声音开关 ----
  useEffect(() => {
    if (soundEnabled) {
      if (
        isDialogueStarted &&
        ambientStartedRef.current &&
        ambientRef.current
      ) {
        safePlay(ambientRef.current);
      }
    } else {
      safePause(ambientRef.current);
    }
  }, [soundEnabled, isDialogueStarted]);

  // ---- 背景音：首次交互后开始播放 ----
  useEffect(() => {
    if (isDialogueStarted && !ambientStartedRef.current) {
      ambientStartedRef.current = true;
      if (soundEnabled) {
        safePlay(ambientRef.current);
      }
    }
  }, [isDialogueStarted, soundEnabled]);

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

    // 结局时停止背景音
    safePause(ambientRef.current);

    if (endingId === "eve_eats_fruit") {
      safePlay(fruitRef.current);
    } else if (endingId === "god_arrives") {
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

  return {
    soundEnabled,
    toggleSound,
    playWhisperSubmit,
    playTemptationProgress,
  };
}
