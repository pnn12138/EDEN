// ============================================================
// Chapter 0 角色语音 Hook（Browser TTS + 音色下拉）
// 优化：支持当前对话角色的独立音色配置，持久化到 localStorage
//
// 模式：
// - off：关闭夏娃语音
// - browser_soft：偏柔和，语速慢、音高略高、音量柔和
// - browser_clear：偏清冷，语速略慢、音高正常、音量清晰
// - browser_default：浏览器默认中文语音
// - generated：高质量生成语音（TTS 不可用时降级）
// ============================================================

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ---- 音色模式 ----
export type EveVoiceMode =
  | "off"
  | "browser_soft"
  | "browser_clear"
  | "browser_default"
  | "generated";

export type VoiceSpeakerId = "eve" | "adam";

// ---- 音色选项（UI 显示） ----
export type VoiceOption = {
  mode: EveVoiceMode;
  label: string;
  preview: string;
};

const EVE_VOICE_OPTIONS: VoiceOption[] = [
  { mode: "off", label: "关闭女人语音", preview: "" },
  { mode: "browser_soft", label: "女人·柔和女声", preview: "我在听。" },
  { mode: "browser_clear", label: "女人·清冷女声", preview: "我在听。" },
  { mode: "browser_default", label: "浏览器默认", preview: "我在听。" },
  { mode: "generated", label: "高质量生成语音", preview: "我在听。" },
];

const ADAM_VOICE_OPTIONS: VoiceOption[] = [
  { mode: "off", label: "关闭亚当语音", preview: "" },
  { mode: "browser_soft", label: "亚当·低缓男声", preview: "我听见了。" },
  { mode: "browser_clear", label: "亚当·清晰男声", preview: "我听见了。" },
  { mode: "browser_default", label: "浏览器默认", preview: "我听见了。" },
  { mode: "generated", label: "高质量生成语音", preview: "我听见了。" },
];

export const VOICE_OPTIONS_BY_SPEAKER: Record<VoiceSpeakerId, VoiceOption[]> = {
  eve: EVE_VOICE_OPTIONS,
  adam: ADAM_VOICE_OPTIONS,
};

// ---- 各模式的语音参数 ----
type VoiceParams = {
  rate: number;
  pitch: number;
  volume: number;
  voiceSelectStrategy: "soft" | "clear" | "low" | "default";
};

const MODE_PARAMS_BY_SPEAKER: Record<VoiceSpeakerId, Record<EveVoiceMode, VoiceParams | null>> = {
  eve: {
    off: null,
    browser_soft: { rate: 0.76, pitch: 1.12, volume: 0.62, voiceSelectStrategy: "soft" },
    browser_clear: { rate: 0.84, pitch: 1.0, volume: 0.78, voiceSelectStrategy: "clear" },
    browser_default: { rate: 1.0, pitch: 1.0, volume: 1.0, voiceSelectStrategy: "default" },
    generated: { rate: 0.84, pitch: 1.08, volume: 0.72, voiceSelectStrategy: "soft" },
  },
  adam: {
    off: null,
    browser_soft: { rate: 0.76, pitch: 0.74, volume: 0.74, voiceSelectStrategy: "low" },
    browser_clear: { rate: 0.88, pitch: 0.82, volume: 0.86, voiceSelectStrategy: "low" },
    browser_default: { rate: 0.94, pitch: 0.88, volume: 0.95, voiceSelectStrategy: "default" },
    generated: { rate: 0.82, pitch: 0.78, volume: 0.8, voiceSelectStrategy: "low" },
  },
};

// ---- Hook 参数 ----
export type UseEveVoiceParams = {
  /** 当前角色回复文本，更新时触发朗读 */
  reply: string | null;
  /** 当前对话角色 */
  speaker: VoiceSpeakerId;
  /** 声音总开关（来自 useChapter0Audio） */
  soundEnabled: boolean;
  /** 是否处于对话阶段 */
  isDialogueActive: boolean;
  /** 游戏是否已结束 */
  isEnded: boolean;
};

// ---- Hook 返回 ----
export type UseEveVoiceReturn = {
  /** 当前音色模式 */
  voiceMode: EveVoiceMode;
  /** 设置音色模式（并自动保存到 localStorage） */
  setVoiceMode: (mode: EveVoiceMode) => void;
  /** 语音是否开启（voiceMode !== "off"） */
  voiceEnabled: boolean;
  /** 音色选项列表 */
  voiceOptions: VoiceOption[];
  /** 预览音色（播放短句） */
  previewVoice: (mode: EveVoiceMode) => void;
  /** 高质量生成语音是否可用 */
  generatedVoiceAvailable: boolean;
};

// ---- 安全检查 ----
function isSpeechSynthesisSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.speechSynthesis !== "undefined" &&
    typeof window.speechSynthesis.speak === "function"
  );
}

// ---- 语音选择策略 ----
function selectVoiceByStrategy(
  voices: SpeechSynthesisVoice[],
  strategy: "soft" | "clear" | "low" | "default",
): SpeechSynthesisVoice | null {
  if (strategy === "default") {
    // 浏览器默认：不指定 voice，由浏览器自动选择
    return null;
  }

  // soft 和 clear 优先寻找特定中文女声
  const softKeywords = ["Xiaoxiao", "Yaoyao", "Huihui", "普通话", "女"];
  const clearKeywords = ["Mandarin", "Chinese", "Female"];
  const lowKeywords = ["Kangkang", "Yunxi", "Yunjian", "Mandarin", "Chinese", "Male", "男"];

  const keywords = strategy === "soft"
    ? softKeywords
    : strategy === "low"
      ? lowKeywords
      : clearKeywords;

  // 第一轮：找 zh-CN 且名字含优先关键词
  for (const kw of keywords) {
    const found = voices.find(
      (v) => v.lang.includes("zh-CN") && v.name.toLowerCase().includes(kw.toLowerCase()),
    );
    if (found) return found;
  }

  // 第二轮：任何包含 zh-CN 的声音
  const zhCN = voices.find((v) => v.lang.includes("zh-CN"));
  if (zhCN) return zhCN;

  // 第三轮：包含 zh 的声音
  const zhAny = voices.find((v) => v.lang.includes("zh"));
  if (zhAny) return zhAny;

  // 找不到中文声音，返回 null（使用浏览器默认）
  return null;
}

// ---- localStorage key ----
const VOICE_MODE_KEYS: Record<VoiceSpeakerId, string> = {
  eve: "eden_eve_voice_mode",
  adam: "eden_adam_voice_mode",
};

function isVoiceMode(value: string): value is EveVoiceMode {
  return value in MODE_PARAMS_BY_SPEAKER.eve;
}

function loadVoiceMode(speaker: VoiceSpeakerId): EveVoiceMode {
  try {
    const stored = localStorage.getItem(VOICE_MODE_KEYS[speaker]);
    if (stored && isVoiceMode(stored)) {
      return stored;
    }
  } catch {
    // localStorage 不可用
  }
  return "browser_soft"; // 默认柔和女声
}

function saveVoiceMode(speaker: VoiceSpeakerId, mode: EveVoiceMode): void {
  try {
    localStorage.setItem(VOICE_MODE_KEYS[speaker], mode);
  } catch {
    // localStorage 不可用，静默忽略
  }
}

export function useEveVoice({
  reply,
  speaker,
  soundEnabled,
  isDialogueActive,
  isEnded,
}: UseEveVoiceParams): UseEveVoiceReturn {
  const [voiceMode, setVoiceModeState] = useState<EveVoiceMode>("browser_soft");
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const prevReplyRef = useRef<string | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const [generatedVoiceAvailable, setGeneratedVoiceAvailable] = useState(false);

  // 加载可用语音列表
  useEffect(() => {
    if (!isSpeechSynthesisSupported()) return;

    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };

    loadVoices();

    // 某些浏览器延迟加载 voices
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  // 停止当前朗读
  const stopSpeaking = useCallback(() => {
    if (isSpeechSynthesisSupported() && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    currentUtteranceRef.current = null;
  }, []);

  // 从 localStorage 加载当前角色的语音配置
  useEffect(() => {
    setVoiceModeState(loadVoiceMode(speaker));
    prevReplyRef.current = null;
    stopSpeaking();
  }, [speaker, stopSpeaking]);

  // ---- 朗读逻辑 ----
  const speakText = useCallback((text: string, mode: EveVoiceMode) => {
    if (!isSpeechSynthesisSupported()) return;
    if (mode === "off") return;

    stopSpeaking();

    const modeParams = MODE_PARAMS_BY_SPEAKER[speaker];
    const params = modeParams[mode];
    if (!params) return;

    // generated 模式：当前 TTS 不可用，降级到 browser_soft
    const effectiveMode = mode === "generated" && !generatedVoiceAvailable
      ? "browser_soft"
      : mode;
    const effectiveParams = modeParams[effectiveMode] ?? modeParams.browser_soft!;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = effectiveParams.rate;
    utterance.pitch = effectiveParams.pitch;
    utterance.volume = effectiveParams.volume;

    const selectedVoice = selectVoiceByStrategy(voicesRef.current, effectiveParams.voiceSelectStrategy);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    currentUtteranceRef.current = utterance;

    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      // 朗读失败，静默降级
    }
  }, [stopSpeaking, generatedVoiceAvailable, speaker]);

  // 当当前角色回复变化时朗读
  useEffect(() => {
    if (
      voiceMode === "off" ||
      !soundEnabled ||
      !isDialogueActive ||
      !reply ||
      reply === prevReplyRef.current
    ) {
      prevReplyRef.current = reply;
      return;
    }

    prevReplyRef.current = reply;
    speakText(reply, voiceMode);
  }, [reply, voiceMode, soundEnabled, isDialogueActive, speakText]);

  // 游戏结束时停止朗读
  useEffect(() => {
    if (isEnded) {
      stopSpeaking();
    }
  }, [isEnded, stopSpeaking]);

  // soundEnabled 关闭时停止朗读
  useEffect(() => {
    if (!soundEnabled) {
      stopSpeaking();
    }
  }, [soundEnabled, stopSpeaking]);

  // 组件卸载时停止朗读
  useEffect(() => {
    return () => {
      if (isSpeechSynthesisSupported() && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // 设置音色模式
  const setVoiceMode = useCallback((mode: EveVoiceMode) => {
    setVoiceModeState(mode);
    saveVoiceMode(speaker, mode);
    if (mode === "off") {
      stopSpeaking();
    }
  }, [speaker, stopSpeaking]);

  // 预览音色
  const previewVoice = useCallback((mode: EveVoiceMode) => {
    if (mode === "off") return;
    const option = VOICE_OPTIONS_BY_SPEAKER[speaker].find((o) => o.mode === mode);
    if (!option || !option.preview) return;
    speakText(option.preview, mode);
  }, [speaker, speakText]);

  const voiceEnabled = voiceMode !== "off";

  return {
    voiceMode,
    setVoiceMode,
    voiceEnabled,
    voiceOptions: VOICE_OPTIONS_BY_SPEAKER[speaker],
    previewVoice,
    generatedVoiceAvailable,
  };
}
