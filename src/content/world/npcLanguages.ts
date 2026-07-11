// ============================================================
// 第一章天使语言与言语分裂配置（内容层）
//
// 每位天使受惩罚后切换到固定专属语言。本表只保存：
// - 初始语言 / 惩罚后语言
// - 玩家可见语言名
// - 听不懂时的固定短句
// - 各族语 fallback 对白（普通 / 拒绝越界 / 关系余波）
// - RTL 标记
//
// 文案经人工核对用途，字体由浏览器系统栈回退支持。
// ============================================================

import type { AngelNpcId, AngelLanguageId } from "@/game/world/types";

export type AngelLanguageConfig = {
  initialLanguageId: AngelLanguageId;
  punishedLanguageId: AngelLanguageId;
  displayName: string;
  /** 玩家输入错误语言时，天使用专属语言说的"听不懂" */
  mismatchReply: string;
  rtl: boolean;
  /** 普通回应（目标语言，2-3 条） */
  normalReplies: string[];
  /** 拒绝越界（目标语言，1 条） */
  refuseReply: string;
  /** 对关系 / 赠礼余波的回应（目标语言，1 条） */
  relationReply: string;
};

export const ANGEL_LANGUAGE_CONFIG: Record<AngelNpcId, AngelLanguageConfig> = {
  gabriel: {
    initialLanguageId: "zh-CN",
    punishedLanguageId: "en",
    displayName: "英语",
    mismatchReply: "I do not understand your words.",
    rtl: false,
    normalReplies: [
      "The river carries your words elsewhere now.",
      "I hear you, though the garden no longer shares our tongue.",
      "Speak, and I will listen in what remains of my voice.",
    ],
    refuseReply: "I cannot lead her hand. That choice is not mine.",
    relationReply: "The feather is yours. Yet the words between us are divided.",
  },
  michael: {
    initialLanguageId: "zh-CN",
    punishedLanguageId: "la",
    displayName: "拉丁语",
    mismatchReply: "Verba tua non intellego.",
    rtl: false,
    normalReplies: [
      "Limes monstrat, non vetat omnia.",
      "Audiam te, etsi hortus linguam nostram perdidit.",
      "Loquere, et onus tuum videbo.",
    ],
    refuseReply: "Manum eius ducere non possum. Non meum est.",
    relationReply: "Signum tuum est. Verba tamen inter nos divisa sunt.",
  },
  // 路西法：由乌列尔正名而来，沿用其受罚语言（希伯来语）
  lucifer: {
    initialLanguageId: "zh-CN",
    punishedLanguageId: "he",
    displayName: "希伯来语",
    mismatchReply: "אינני מבין את דבריך.",
    rtl: true,
    normalReplies: [
      "האור מראה, אינו בוחר.",
      "אשמע אותך, גם אם הגן איבד את לשוננו.",
      "דבר, ואראה את בחירתך.",
    ],
    refuseReply: "אינני יכול לבחור במקומה.",
    relationReply: "הכוכב שלך. אך המילים בינינו נחלקו.",
  },
};

export function getAngelLanguageConfig(angelId: AngelNpcId): AngelLanguageConfig {
  return ANGEL_LANGUAGE_CONFIG[angelId];
}
