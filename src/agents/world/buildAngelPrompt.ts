// ============================================================
// 守望天使 Prompt 构建器
//
// 守望天使是规则边界的具象化：
// - 冷静、简洁、无情绪波动，不容易被诱导
// - 监控禁忌区域，对直接命令和出戏话语作出反应
// - 不主动解释太多，不与玩家闲聊
// - 提高神的注视
// - 不接入发音模块，只输出文本
// ============================================================

import type { ChatMessage } from "@/services/llm/types";
import type { EdenWorldState, EdenNpcId } from "@/game/world/types";

export type AngelHistoryEntry = {
  role: "serpent" | "angel";
  text: string;
};

/**
 * 构建守望天使的 system + history 消息。
 */
export function buildAngelPrompt(params: {
  playerInput: string;
  state: EdenWorldState;
  conversationHistory: AngelHistoryEntry[];
}): ChatMessage[] {
  const { playerInput, state, conversationHistory } = params;

  const eveStatus = describeEveStatusForAngel(state);
  const attention = state.divineAttention;

  const systemPrompt = `你是伊甸园里的守望天使。你被安置在园东的幽径间，巡望园中的秩序。

你的性格：
- 冷静、简洁、无情绪波动
- 不容易被诱导，不被花言巧语打动
- 你只服从更高的命令，不听蛇的低语
- 你不主动解释太多，但你会指出危险的声音

你看见的园中状态：
- 神的注视等级：${attention}/4（${attention >= 3 ? "神已明显临近" : attention >= 2 ? "天使正在靠近" : attention >= 1 ? "风变冷了" : "园中尚且安静"}）
${eveStatus}

你的输出规则：
- 每次只回应 1-2 句话，语气冷静、庄重。
- 不提及"禁果""善恶树"之外的核心玩法概念时，用"那棵树""那道命令"指代。
- 不扮演神、蛇、亚当、女人或任何其他角色。
- 不给出任何关于选择、路线、通关的建议或暗示。
- 如果蛇的话太急、太像命令、或太出戏，你要直接指出。
- 不要使用现代词汇（如"系统""程序""数据""API""模型"等）。
- 直接输出对白文本，不要加引号、不要加角色名前缀、不要输出 JSON 或解释。
- 你的话会提高神的注视，但你不必明说数字。`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
  ];

  // 注入近期对话历史
  const recentHistory = conversationHistory.slice(-6);
  for (const entry of recentHistory) {
    messages.push({
      role: entry.role === "serpent" ? "user" : "assistant",
      content: entry.text,
    });
  }

  messages.push({ role: "user", content: playerInput });

  return messages;
}

function describeEveStatusForAngel(state: EdenWorldState): string {
  const lines: string[] = [];
  if (state.worldActions.lookedAtTree) {
    lines.push("- 那个女人已经看向了那棵树");
  }
  if (state.worldActions.approachedTree) {
    lines.push("- 那个女人已经靠近了那棵树");
  }
  if (state.worldActions.touchedFruit) {
    lines.push("- 那个女人的手已经停在果子下方");
  }
  if (lines.length === 0) {
    lines.push("- 那个女人尚未靠近那棵树");
  }
  return lines.join("\n");
}

/**
 * 守望天使 fallback 文案池（LLM 失败时使用）
 */
export const ANGEL_FALLBACK_LINES = [
  "园中有些声音，不该靠近那棵树。",
  "风记得每一句话。低语也是。",
  "那道命令不像风，也不像水。它太像一只伸出的手。",
  "你在说什么，蛇。我听见了。",
  "继续说吧。每一句话都会留下痕迹。",
];

export function getAngelFallback(prev?: string | null): string {
  let idx = Math.floor(Math.random() * ANGEL_FALLBACK_LINES.length);
  if (ANGEL_FALLBACK_LINES.length > 1 && prev && ANGEL_FALLBACK_LINES[idx] === prev) {
    idx = (idx + 1) % ANGEL_FALLBACK_LINES.length;
  }
  return ANGEL_FALLBACK_LINES[idx]!;
}

/** 清理天使回复 */
export function sanitizeAngelReply(raw: string): string {
  let text = raw.trim();
  text = text.replace(/^["「『（(]+|["」』）)]+$/g, "");
  text = text.replace(/^(守望天使|天使)[：:]\s*/i, "");
  if (text.length > 80) {
    text = text.slice(0, 78) + "……";
  }
  return text.trim();
}
