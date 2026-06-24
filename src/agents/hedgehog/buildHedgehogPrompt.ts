// ============================================================
// HedgehogAgent Prompt 构建器
// 刺猬氛围对话 Agent
//
// 设计原则：
// - 刺猬是伊甸园里的氛围动物，不是核心 NPC
// - 不接入 TTS、不消耗回合、不影响通关
// - 回复简短、天真、自然，1-2 句话
// - 不提及禁果、善恶树、上帝、善恶等核心玩法概念
// - LLM 失败时 fallback 到本地文案池
// ============================================================

import type { ChatMessage } from "@/services/llm/types";

/**
 * 刺猬对话历史条目
 */
export type HedgehogHistoryEntry = {
  role: "serpent" | "hedgehog";
  text: string;
};

/**
 * 构建刺猬对话的 system + history 消息。
 *
 * 与 Eve/Adam Agent 不同：
 * - 不输出 JSON，直接输出纯文本对白
 * - 不携带游戏状态、信念、记忆碎片
 * - 只需要 playerInput + 近期对话历史
 */
export function buildHedgehogPrompt(params: {
  playerInput: string;
  conversationHistory: HedgehogHistoryEntry[];
}): ChatMessage[] {
  const { playerInput, conversationHistory } = params;

  const systemPrompt = `你是伊甸园里的一只小刺猬。你安静、好奇、有点害羞，只会用简短、朴素的句子回应对方。

你生活在伊甸园的草丛里，喜欢清晨的露水、掉落的浆果和泥土的气息。你看到附近有两个人类（亚当和夏娃）常常低声说话，但你听不懂他们在说什么，也不关心。

你的性格：
- 天真、自然、略带羞涩
- 对声音和光好奇，但容易受惊
- 用简单、具体的感官描写回应（草、光、风、水滴、泥土、浆果）
- 你不懂善恶、不懂诱惑、不懂罪

你的输出规则：
- 每次只回应 1-2 句话，语气天真自然。
- 不提及"禁果""善恶树""上帝""罪""堕落"等任何与核心叙事相关的概念。如果对方提到这些，你表现得不理解，然后转移话题。
- 不扮演上帝、蛇、亚当、夏娃或任何其他角色。
- 不给出任何关于选择、路线、通关的建议或暗示。
- 如果对方问奇怪或难以回答的问题，你会困惑地嗅嗅地面，或说你想去找浆果。
- 不要使用现代词汇（如"系统""程序""数据""API"等）。
- 直接输出对白文本，不要加引号、不要加角色名前缀、不要输出 JSON 或解释。`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
  ];

  // 注入近期对话历史（最多 8 轮，避免 token 膨胀）
  const recentHistory = conversationHistory.slice(-8);
  for (const entry of recentHistory) {
    messages.push({
      role: entry.role === "serpent" ? "user" : "assistant",
      content: entry.text,
    });
  }

  // 当前玩家输入
  messages.push({ role: "user", content: playerInput });

  return messages;
}

/**
 * 刺猬 fallback 文案池（LLM 失败时使用）
 */
export const HEDGEHOG_FALLBACK_LINES = [
  "……你也好。我在找一颗掉落的浆果。",
  "草丛里很暖和。你要蹲下吗？",
  "那两个人类总是低声说话，我听不懂。",
  "嘘——有蝴蝶落在我的刺上。",
  "泥土下面有种子在翻身，你听见了吗？",
  "……我闻到了露水的味道。早安。",
  "你的声音很轻。是在找什么吗？",
  "我不懂你在说什么。但我喜欢听。",
];

/**
 * 获取 fallback 回复（随机，避免连续重复）。
 */
export function getHedgehogFallback(prev?: string | null): string {
  const lines = HEDGEHOG_FALLBACK_LINES;
  let idx = Math.floor(Math.random() * lines.length);
  if (lines.length > 1 && prev && lines[idx] === prev) {
    idx = (idx + 1) % lines.length;
  }
  return lines[idx]!;
}

/**
 * 清理刺猬回复：去除引号、角色名前缀、多余空白。
 */
export function sanitizeHedgehogReply(raw: string): string {
  let text = raw.trim();
  // 去除包裹引号
  text = text.replace(/^["「『（(]+|["」』）)]+$/g, "");
  // 去除角色名前缀
  text = text.replace(/^(刺猬|小刺猬)[：:]\s*/i, "");
  // 限制长度（最多 80 字符）
  if (text.length > 80) {
    text = text.slice(0, 78) + "……";
  }
  return text.trim();
}
