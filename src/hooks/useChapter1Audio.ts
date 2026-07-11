// ============================================================
// Chapter 1 音效反馈 Hook
// 集成第一章所有新增动作音效，支持场景环境音切换
//
// 触发规则：
// - chapter1_eden_world_ambient：explore 阶段循环播放主环境音
// - 动作音效：成功执行动作后单次播放
// - 不同地点可叠加专属环境音（如四河源头叠加水声）
//
// 容错：
// - 音频缺失时 console.warn，不报错
// - 浏览器阻止播放时不报错
// - 全部 client side，无 SSR/hydration 问题
// ============================================================

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CHAPTER1_AUDIO } from "@/game/assets";

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
    console.warn(`[Chapter1 Audio] Failed to create audio element: ${src}`);
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
export type UseChapter1AudioParams = {
  /** 当前游戏阶段 */
  phase: "intro" | "explore" | "ending";
  /** 当前地点 ID */
  locationId: string;
  /** 神的注视等级，0-4 */
  divineAttention: number;
  /** 声音是否总开关（复用 Chapter 0 开关） */
  soundEnabled: boolean;
};

// ---- Hook 返回 ----
export type UseChapter1AudioReturn = {
  // 动作音效播放方法
  playMapMove: () => void;
  playObserveLocation: () => void;
  playNpcDialogue: () => void;
  playHedgehogRustle: () => void;
  playDivineAttentionRise: () => void;
  playAngelWingDistant: () => void;
  playTreeLook: () => void;
  playApproachTree: () => void;
  playTouchFruit: () => void;
  // 结局 / 献礼 / 回响 / 印记 / 昼夜 音效
  playEndingSuccess: () => void;
  playEndingFailure: () => void;
  playDivineGift: () => void;
  playResonanceGain: () => void;
  playMarkUnlock: () => void;
  playDayNightShift: () => void;
};

export function useChapter1Audio({
  phase,
  locationId,
  divineAttention,
  soundEnabled,
}: UseChapter1AudioParams): UseChapter1AudioReturn {
  // 环境音引用
  const mainAmbientRef = useRef<HTMLAudioElement | null>(null);
  const riverAmbientRef = useRef<HTMLAudioElement | null>(null);

  // 动作音效引用
  const mapMoveRef = useRef<HTMLAudioElement | null>(null);
  const observeRef = useRef<HTMLAudioElement | null>(null);
  const npcMurmurRef = useRef<HTMLAudioElement | null>(null);
  const hedgehogRef = useRef<HTMLAudioElement | null>(null);
  const divineRiseRef = useRef<HTMLAudioElement | null>(null);
  const angelWingRef = useRef<HTMLAudioElement | null>(null);
  const treeLookRef = useRef<HTMLAudioElement | null>(null);
  const approachTreeRef = useRef<HTMLAudioElement | null>(null);
  const touchFruitRef = useRef<HTMLAudioElement | null>(null);
  const endingSuccessRef = useRef<HTMLAudioElement | null>(null);
  const endingFailureRef = useRef<HTMLAudioElement | null>(null);
  const divineGiftRef = useRef<HTMLAudioElement | null>(null);
  const resonanceGainRef = useRef<HTMLAudioElement | null>(null);
  const markUnlockRef = useRef<HTMLAudioElement | null>(null);
  const dayNightShiftRef = useRef<HTMLAudioElement | null>(null);

  // 追踪前一个地点和注视，用于环境音切换
  const prevLocationRef = useRef(locationId);
  const prevDivineRef = useRef(divineAttention);
  const mainAmbientPlayingRef = useRef(false);
  const riverAmbientPlayingRef = useRef(false);

  // ---- 初始化音频元素（client side only） ----
  useEffect(() => {
    // 主环境音
    mainAmbientRef.current = createAudioElement(CHAPTER1_AUDIO.edenWorldAmbient);
    if (mainAmbientRef.current) {
      mainAmbientRef.current.loop = true;
      mainAmbientRef.current.volume = 0.12;
    }

    // 四河源头专属环境音
    riverAmbientRef.current = createAudioElement(CHAPTER1_AUDIO.fourRiverSourceLoop);
    if (riverAmbientRef.current) {
      riverAmbientRef.current.loop = true;
      riverAmbientRef.current.volume = 0.18;
    }

    // 动作音效
    mapMoveRef.current = createAudioElement(CHAPTER1_AUDIO.mapMoveSoftSteps);
    if (mapMoveRef.current) mapMoveRef.current.volume = 0.35;

    observeRef.current = createAudioElement(CHAPTER1_AUDIO.observeLocationChime);
    if (observeRef.current) observeRef.current.volume = 0.4;

    npcMurmurRef.current = createAudioElement(CHAPTER1_AUDIO.npcDialogueMurmur);
    if (npcMurmurRef.current) npcMurmurRef.current.volume = 0.25;

    hedgehogRef.current = createAudioElement(CHAPTER1_AUDIO.hedgehogRustle);
    if (hedgehogRef.current) hedgehogRef.current.volume = 0.4;

    divineRiseRef.current = createAudioElement(CHAPTER1_AUDIO.divineAttentionRise);
    if (divineRiseRef.current) divineRiseRef.current.volume = 0.3;

    angelWingRef.current = createAudioElement(CHAPTER1_AUDIO.angelWingDistant);
    if (angelWingRef.current) angelWingRef.current.volume = 0.3;

    treeLookRef.current = createAudioElement(CHAPTER1_AUDIO.treeLookChime);
    if (treeLookRef.current) treeLookRef.current.volume = 0.4;

    approachTreeRef.current = createAudioElement(CHAPTER1_AUDIO.approachTreeLowRise);
    if (approachTreeRef.current) approachTreeRef.current.volume = 0.35;

    touchFruitRef.current = createAudioElement(CHAPTER1_AUDIO.touchFruitTension);
    if (touchFruitRef.current) touchFruitRef.current.volume = 0.45;

    // 结局 / 献礼 / 回响 / 印记 / 昼夜 音效
    endingSuccessRef.current = createAudioElement(CHAPTER1_AUDIO.endingSuccess);
    if (endingSuccessRef.current) endingSuccessRef.current.volume = 0.4;

    endingFailureRef.current = createAudioElement(CHAPTER1_AUDIO.endingFailure);
    if (endingFailureRef.current) endingFailureRef.current.volume = 0.4;

    // 献礼 / 印记音量低于对话音（对话音 0.25）
    divineGiftRef.current = createAudioElement(CHAPTER1_AUDIO.divineGiftLight);
    if (divineGiftRef.current) divineGiftRef.current.volume = 0.16;

    resonanceGainRef.current = createAudioElement(CHAPTER1_AUDIO.resonanceGain);
    if (resonanceGainRef.current) resonanceGainRef.current.volume = 0.3;

    markUnlockRef.current = createAudioElement(CHAPTER1_AUDIO.markUnlock);
    if (markUnlockRef.current) markUnlockRef.current.volume = 0.18;

    dayNightShiftRef.current = createAudioElement(CHAPTER1_AUDIO.dayNightShift);
    if (dayNightShiftRef.current) dayNightShiftRef.current.volume = 0.22;

    return () => {
      safePause(mainAmbientRef.current);
      safePause(riverAmbientRef.current);
    };
  }, []);

  // ---- 地点切换处理：更新叠加环境音 ----
  useEffect(() => {
    if (!soundEnabled || phase !== "explore") return;

    const prevLocation = prevLocationRef.current;
    prevLocationRef.current = locationId;

    // 处理主环境音
    if (!mainAmbientPlayingRef.current && phase === "explore") {
      safePlay(mainAmbientRef.current).then((ok) => {
        if (ok) mainAmbientPlayingRef.current = true;
      });
    }

    // 处理四河源头叠加水声
    const isFourRiver = locationId === "four_river_source";
    const wasFourRiver = prevLocation === "four_river_source";

    if (isFourRiver && !riverAmbientPlayingRef.current && soundEnabled) {
      safePlay(riverAmbientRef.current).then((ok) => {
        if (ok) riverAmbientPlayingRef.current = true;
      });
    } else if (!isFourRiver && riverAmbientPlayingRef.current) {
      fadeOutAudio(riverAmbientRef.current, 800);
      riverAmbientPlayingRef.current = false;
    }

    // 处理神的注视升高播放天使羽翼声
    if (divineAttention > prevDivineRef.current && divineAttention >= 2) {
      safePlay(angelWingRef.current);
    }
    prevDivineRef.current = divineAttention;
  }, [locationId, divineAttention, phase, soundEnabled]);

  // ---- 声音开关 ----
  useEffect(() => {
    if (!mainAmbientRef.current) return;

    if (soundEnabled && phase === "explore") {
      safePlay(mainAmbientRef.current).then((ok) => {
        if (ok) mainAmbientPlayingRef.current = true;
      });
      if (locationId === "four_river_source") {
        safePlay(riverAmbientRef.current).then((ok) => {
          if (ok) riverAmbientPlayingRef.current = true;
        });
      }
    } else {
      fadeOutAudio(mainAmbientRef.current);
      fadeOutAudio(riverAmbientRef.current);
      mainAmbientPlayingRef.current = false;
      riverAmbientPlayingRef.current = false;
    }
  }, [soundEnabled, phase, locationId]);

  // ---- 各个动作播放方法 ----
  const playMapMove = useCallback(() => {
    if (soundEnabled) {
      safePlay(mapMoveRef.current);
    }
  }, [soundEnabled]);

  const playObserveLocation = useCallback(() => {
    if (soundEnabled) {
      safePlay(observeRef.current);
    }
  }, [soundEnabled]);

  const playNpcDialogue = useCallback(() => {
    if (soundEnabled) {
      safePlay(npcMurmurRef.current);
    }
  }, [soundEnabled]);

  const playHedgehogRustle = useCallback(() => {
    if (soundEnabled) {
      safePlay(hedgehogRef.current);
    }
  }, [soundEnabled]);

  const playDivineAttentionRise = useCallback(() => {
    if (soundEnabled) {
      safePlay(divineRiseRef.current);
    }
  }, [soundEnabled]);

  const playAngelWingDistant = useCallback(() => {
    if (soundEnabled) {
      safePlay(angelWingRef.current);
    }
  }, [soundEnabled]);

  const playTreeLook = useCallback(() => {
    if (soundEnabled) {
      safePlay(treeLookRef.current);
    }
  }, [soundEnabled]);

  const playApproachTree = useCallback(() => {
    if (soundEnabled) {
      safePlay(approachTreeRef.current);
    }
  }, [soundEnabled]);

  const playTouchFruit = useCallback(() => {
    if (soundEnabled) {
      safePlay(touchFruitRef.current);
    }
  }, [soundEnabled]);

  const playEndingSuccess = useCallback(() => {
    if (soundEnabled) {
      safePlay(endingSuccessRef.current);
    }
  }, [soundEnabled]);

  const playEndingFailure = useCallback(() => {
    if (soundEnabled) {
      safePlay(endingFailureRef.current);
    }
  }, [soundEnabled]);

  const playDivineGift = useCallback(() => {
    if (soundEnabled) {
      safePlay(divineGiftRef.current);
    }
  }, [soundEnabled]);

  const playResonanceGain = useCallback(() => {
    if (soundEnabled) {
      safePlay(resonanceGainRef.current);
    }
  }, [soundEnabled]);

  const playMarkUnlock = useCallback(() => {
    if (soundEnabled) {
      safePlay(markUnlockRef.current);
    }
  }, [soundEnabled]);

  const playDayNightShift = useCallback(() => {
    if (soundEnabled) {
      safePlay(dayNightShiftRef.current);
    }
  }, [soundEnabled]);

  return {
    playMapMove,
    playObserveLocation,
    playNpcDialogue,
    playHedgehogRustle,
    playDivineAttentionRise,
    playAngelWingDistant,
    playTreeLook,
    playApproachTree,
    playTouchFruit,
    playEndingSuccess,
    playEndingFailure,
    playDivineGift,
    playResonanceGain,
    playMarkUnlock,
    playDayNightShift,
  };
}
