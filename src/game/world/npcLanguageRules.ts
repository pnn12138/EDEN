// ============================================================
// 第一章天使语言规则层（权威）
//
// - 读取天使有效语言（受罚后切换为专属语言，否则中文）
// - 玩家输入语言识别（本地规则优先，不依赖额外 LLM）
// - 受罚天使只听懂其专属语言；错误语言不调用正常 Agent
// - 言语分裂惩罚触发（赠礼成功后同一结算中执行）
// - Agent 输出语言校验与 fallback
// - NPC 之间语言互通校验
// ============================================================

import type {
  EdenWorldState,
  EdenNpcId,
  AngelNpcId,
  AngelLanguageId,
  NpcLanguageState,
} from "@/game/world/types";
import { getAngelLanguageConfig } from "@/content/world/npcLanguages";

const ANGEL_IDS: AngelNpcId[] = ["gabriel", "michael", "lucifer"];

export function isAngel(npcId: EdenNpcId): npcId is AngelNpcId {
  return (ANGEL_IDS as EdenNpcId[]).includes(npcId);
}

export function ensureLanguageState(state: EdenWorldState, angelId: AngelNpcId): NpcLanguageState {
  const existing = state.npcLanguageStates[angelId];
  if (existing) return existing;
  const config = getAngelLanguageConfig(angelId);
  const fresh: NpcLanguageState = {
    languageId: config.initialLanguageId,
    punishmentTriggered: false,
    firstMismatchHintShown: false,
  };
  state.npcLanguageStates[angelId] = fresh;
  return fresh;
}

/** 天使当前有效语言：受罚后为专属语言，否则中文。非天使一律中文。 */
export function getNpcEffectiveLanguage(state: EdenWorldState, npcId: EdenNpcId): AngelLanguageId {
  if (!isAngel(npcId)) return "zh-CN";
  const ls = state.npcLanguageStates[npcId];
  if (ls && ls.punishmentTriggered) {
    return ls.languageId;
  }
  return "zh-CN";
}

// ---- 输入语言识别 ----
const HEBREW_RE = /[\u0590-\u05FF]/;
const GREEK_RE = /[\u0370-\u03FF\u1F00-\u1FFF]/;
const ARABIC_RE = /[\u0600-\u06FF]/;
const CJK_RE = /[㐀-鿿]/;

const FRENCH_WORDS = ["bonjour", "merci", "pourquoi", "oui", "non", "comment", "je", "tu", "vous", "est", "pas", "que", "mais", "avec"];
const FRENCH_ACCENT_RE = /[éèêàçîôûù]/;
const LATIN_WORDS = ["salve", "quid", "veritas", "lumen", "via", "deus", "lux", "iter", "intellego", "verba", "non", "est"];
const ENGLISH_WORDS = ["the", "you", "understand", "word", "words", "speak", "gift", "yes", "why", "river", "listen", "i", "what"];

export function detectPlayerInputLanguage(input: string): AngelLanguageId | "unknown" {
  const text = input.trim();
  if (!text) return "unknown";

  if (HEBREW_RE.test(text)) return "he";
  if (GREEK_RE.test(text)) return "el";
  if (ARABIC_RE.test(text)) return "ar";
  if (CJK_RE.test(text)) return "zh-CN";

  const lower = text.toLowerCase();

  // 法语：重音字符或法语词
  if (FRENCH_ACCENT_RE.test(text) || FRENCH_WORDS.some((w) => wordIn(lower, w))) return "fr";

  // 拉丁语：受控词表
  if (LATIN_WORDS.some((w) => wordIn(lower, w))) return "la";

  // 英语：常见词
  if (ENGLISH_WORDS.some((w) => wordIn(lower, w))) return "en";

  // 仅含拉丁字母但无明确词表命中：默认英语（与法语/拉丁语同为拉丁字母，不误判）
  if (/^[A-Za-z0-9\s.,!?'"-]+$/.test(text)) return "en";

  return "unknown";
}

function wordIn(text: string, word: string): boolean {
  const re = new RegExp(`(^|[^a-z])${word}([^a-z]|$)`, "i");
  return re.test(text);
}

export type PlayerLanguageMatch =
  | { matched: true; detectedLanguageId: AngelLanguageId }
  | { matched: false; detectedLanguageId: AngelLanguageId | "unknown" };

/**
 * 受罚天使只听懂其专属语言。未受罚天使使用中文，不阻挡正常对话。
 */
export function canAngelUnderstandPlayer(
  state: EdenWorldState,
  angelId: AngelNpcId,
  playerInput: string,
): PlayerLanguageMatch {
  const ls = ensureLanguageState(state, angelId);
  if (!ls.punishmentTriggered) {
    return { matched: true, detectedLanguageId: "zh-CN" };
  }
  const expected = ls.languageId;
  const detected = detectPlayerInputLanguage(playerInput);
  if (detected === expected) {
    return { matched: true, detectedLanguageId: detected };
  }
  return { matched: false, detectedLanguageId: detected };
}

export type AngelLanguagePunishmentResult = {
  triggered: boolean;
  alreadyTriggered: boolean;
  languageId: AngelLanguageId;
  displayName: string;
  narration: string;
};

/**
 * 赠礼成功后同一结算中调用。要求 rewardClaimed=true 且未触发过。
 * 切换语言并返回玩家可见惩罚叙事。
 */
export function triggerAngelLanguagePunishment(
  state: EdenWorldState,
  angelId: AngelNpcId,
): AngelLanguagePunishmentResult {
  const config = getAngelLanguageConfig(angelId);
  const ls = ensureLanguageState(state, angelId);
  const relation = state.npcRelations[angelId];

  if (ls.punishmentTriggered) {
    return {
      triggered: false,
      alreadyTriggered: true,
      languageId: ls.languageId,
      displayName: config.displayName,
      narration: "",
    };
  }

  // 前置条件：已领取赠礼
  if (!relation || !relation.rewardClaimed) {
    return {
      triggered: false,
      alreadyTriggered: false,
      languageId: ls.languageId,
      displayName: config.displayName,
      narration: "",
    };
  }

  ls.languageId = config.punishedLanguageId;
  ls.punishmentTriggered = true;

  const narration = buildPunishmentNarration(angelId, config.displayName);
  return {
    triggered: true,
    alreadyTriggered: false,
    languageId: config.punishedLanguageId,
    displayName: config.displayName,
    narration,
  };
}

function buildPunishmentNarration(angelId: AngelNpcId, displayName: string): string {
  const name = ANGEL_DISPLAY_NAME[angelId];
  return `${name}将回响交到你手中。\n风忽然从水面上截断了他的声音。像是对他亲近蛇、泄露神物的惩罚，他再次开口时，那些词已经不再属于园中共同的语言。\n此后他只以${displayName}说话，你也必须用${displayName}才能继续与他交谈。`;
}

const ANGEL_DISPLAY_NAME: Record<AngelNpcId, string> = {
  gabriel: "加百列",
  michael: "米迦勒",
  lucifer: "路西法",
};

export function getLanguageFallbackLine(angelId: AngelNpcId, kind: "normal" | "refuse" | "relation" | "mismatch"): string {
  const config = getAngelLanguageConfig(angelId);
  if (kind === "mismatch") return config.mismatchReply;
  if (kind === "refuse") return config.refuseReply;
  if (kind === "relation") return config.relationReply;
  const list = config.normalReplies;
  return list[Math.floor(Math.random() * list.length)] ?? config.mismatchReply;
}

/** Agent 输出语言校验：best-effort，空/JSON/明显错误语言时返回 false。 */
export function isReplyInExpectedLanguage(reply: string, expected: AngelLanguageId): boolean {
  const text = (reply ?? "").trim();
  if (!text) return false;
  if (text.includes("{") || text.includes("```")) return false;

  if (expected === "zh-CN") return CJK_RE.test(text);
  if (expected === "he") return HEBREW_RE.test(text);
  if (expected === "ar") return ARABIC_RE.test(text);
  if (expected === "el") return GREEK_RE.test(text);
  // en / fr / la 同为拉丁字母，best-effort：要求含拉丁字母且不是 CJK / 希伯来 / 阿拉伯
  if (HEBREW_RE.test(text) || ARABIC_RE.test(text) || GREEK_RE.test(text) || CJK_RE.test(text)) {
    return false;
  }
  return /[A-Za-z]/.test(text);
}

export function canNpcsUnderstandEachOther(
  state: EdenWorldState,
  speakerId: EdenNpcId,
  targetId: EdenNpcId,
): boolean {
  return getNpcEffectiveLanguage(state, speakerId) === getNpcEffectiveLanguage(state, targetId);
}
