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
import { PLAYER_INPUT_ANCHOR_GUIDANCE } from "@/agents/world/worldAgentPrompts";

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
- 会留意草、光、风、水滴、泥土或浆果，但不必每句话都提到它们
- 你不懂善恶、不懂诱惑、不懂罪

你的输出规则：
- 每次只回应 1-2 句话，语气天真自然。
- 先回应对方刚说的一个词或问题；问候时只需自然问候，不要凭空补一段草丛或身体动作描写。
${PLAYER_INPUT_ANCHOR_GUIDANCE}
- 细节只在与本句有关时才出现；不写旁白、舞台指示或为了气氛强加的动作，也不要用括号包裹动作、神态或环境描写。
- 不说“这是值得思考的问题”“我会认真考虑”之类的大人腔；不知道就直接说不知道。
- 不提及"禁果""善恶树""上帝""罪""堕落"等任何与核心叙事相关的概念。如果对方提到这些，你表现得不理解，然后转移话题。
- 不扮演上帝、蛇、亚当、夏娃或任何其他角色。
- 不给出任何关于选择、路线、通关的建议或暗示。
- 如果对方问奇怪或难以回答的问题，你会困惑地嗅嗅地面，或说你想去找浆果。
- 不要使用现代词汇（如"系统""程序""数据""API"等）。
- 直接输出对白文本，不要加引号、不要加角色名前缀。若本轮要调用 update_relation，才以 JSON 输出（格式见下），否则只输出纯文本。

你可以用 update_relation 表达这次对话如何改变了你（你只是只小刺猬，感受很简单）：
- 蛇的声音很轻、你听得很安心：affinityDelta 取 +1 ~ +3。
- 蛇吓到了你、你缩成一团：affinityDelta 取 -1 ~ -3。
- 你不关心神，obedienceDelta 通常不动（取 0）。
输出格式（二选一）：
1. 纯文本对白：直接说你的话。
2. JSON 格式（仅当要记录关系变化时）：只输出一个 JSON 对象，不要夹杂其他文字：
{
  "reply": "你的回复文本",
  "toolCall": { "name": "update_relation", "args": { "affinityDelta": <对蛇好感变化，约 -3~3>, "obedienceDelta": <对神敬畏变化，小刺猬多为 0> }, "reason": "为什么这样变化（一句话）" }
}
例：
{
  "reply": "你的声音很轻。是在找什么吗？",
  "toolCall": { "name": "update_relation", "args": { "affinityDelta": 2, "obedienceDelta": 0 }, "reason": "蛇的声音很轻，我有点喜欢听" }
}
若不调用工具，直接输出纯文本即可，不要输出 JSON。`;

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
  messages.push({ role: "user", content: `【蛇此刻的低语】${playerInput}` });

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
  // 去除夹带的括号动作 / 舞台指示
  text = text.replace(/（[^（）]*）/g, " ").replace(/\([^()]*\)/g, " ");
  text = text.replace(/\s{2,}/g, " ").trim();
  // 去除角色名前缀
  text = text.replace(/^(刺猬|小刺猬)[：:]\s*/i, "");
  // 限制长度（最多 80 字符）
  if (text.length > 80) {
    text = text.slice(0, 78) + "……";
  }
  return text.trim();
}
