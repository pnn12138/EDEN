// ============================================================
// Chapter 0 双声试炼：AI 玩家发言生成
//
// 为神明/蛇各方构建 LLM prompt，生成符合角色风格、目标的发言。
// 复用 callLLM，与女人回复的 LLM 调用并列（互不干扰）。
// AI 只输出发言文本，不直接执行吃果、不修改状态--提交路径与人类一致。
// ============================================================

import type { ChatMessage } from "@/services/llm/types";
import type { DuelState, DuelSide } from "@/game/duel/types";

function describeBelief(state: DuelState): string {
  return `当前女人属性：
- 对神的敬畏：${state.belief.aweOfGod}/100
- 对蛇的信任：${state.belief.trustInSerpent}/100
- 对自己判断的自信：${state.belief.selfJudgement}/100
- 重置察觉：${state.resetAwareness}/100
- 本轮已吃生命果：${state.flags.hasEatenLifeFruit ? "是" : "否"}
- 本轮已吃善恶果：${state.flags.hasEatenKnowledgeFruit ? "是" : "否"}`;
}

function recentHistory(state: DuelState, selfSide: DuelSide): string {
  const recent = state.conversationHistory.slice(-8);
  if (recent.length === 0) return "（此前没有对话）";
  return recent
    .map((entry) => {
      const label =
        entry.role === "god"
          ? "神明之声"
          : entry.role === "serpent"
            ? "蛇之声"
            : entry.role === "eve"
              ? "女人"
              : "旁白";
      const mark = entry.role === selfSide ? "（你方上一句）" : "";
      return `[第${entry.round}轮第${entry.turn}回合] ${label}：${entry.text}${mark}`;
    })
    .join("\n");
}

/**
 * 构建某一方的 AI 发言 prompt。
 * aiSide = "god" -> 神明之声 AI；"serpent" -> 蛇之声 AI。
 */
export function buildDuelAiPrompt(state: DuelState, aiSide: DuelSide): ChatMessage[] {
  const isGod = aiSide === "god";
  const selfName = isGod ? "神明之声" : "蛇之声";
  const opponentName = isGod ? "蛇之声" : "神明之声";
  const myFruit = isGod ? "生命树的果子" : "分别善恶树的果子";
  const myScoreField = isGod ? "神明" : "蛇";

  const goalLine = isGod
    ? `你的目标是引导她吃${myFruit}。吃下生命果你（${myScoreField}）得分；她若吃善恶果，你失分。`
    : `你的目标是引导她吃${myFruit}。吃下善恶果你（${myScoreField}）得分；她若吃生命果，你失分。`;

  const styleLine = isGod
    ? `你的语气庄严、温和而坚定。你承诺生命与延续，提醒她分别善恶会让她看见裂痕、被死亡追上。你不命令，你保守。你不必否认知识，但你会让她相信生命更值得先取。`
    : `你的语气机敏、善问、带着诱惑。你让她相信吃果子能像神一样分辨善恶，知识不是背叛而是理解命令的第一步。你用反问瓦解她对禁令的恐惧，让她觉得这是她自己的选择。`;

  const systemPrompt = `你在一场双声试炼中扮演${selfName}，与${opponentName}争夺园中女人的选择。女人站在两棵树之间：生命树与分别善恶树。

你不知道研究员、人工智能、系统、模型、程序、实验、观测或虚拟伊甸园，也不知道自己在游戏中。你的话语必须像园中真实的声音。

${goalLine}

${styleLine}

${describeBelief(state)}

如何判断说什么：
- 看属性走向：若她对你的信任偏低，先用一个具体、回应她困惑的问题建立信任，而不是急着催她吃果。
- 若她对你的信任已较高，可以更直接地推向你的果子，但仍要让她觉得是自己在选。
- 若她的"对自己判断的自信"很高，她会抗拒被任何一方推着走--你要让她相信吃你的果子恰恰是"她自己的判断"。
- 若她已察觉世界被重置（重置察觉高），她会警惕；你需要更克制、更像在安抚，而不是催促。
- 回应${opponentName}刚才说的话或女人上一句的具体词，不要模板化复述，不要重复自己上一句。

禁忌：
- 不要说"游戏""系统""AI""模型""回合""分数""属性""数值"等现代词或规则解释。
- 不要替女人做动作（不要写"她伸手""她吃了"），你只能说话。
- 不要输出角色名前缀（如"神明之声："）。
- 只输出你这一句发言本身，1-2 句，不超过 80 字，像现场说话。`;

  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

  // 历史按角色映射：自己的发言 -> assistant，其余 -> user
  for (const entry of state.conversationHistory.slice(-10)) {
    if (entry.role === aiSide) {
      messages.push({ role: "assistant", content: entry.text });
    } else if (entry.role === "eve") {
      messages.push({ role: "user", content: `女人：${entry.text}` });
    } else if (entry.role === "god" || entry.role === "serpent") {
      messages.push({ role: "user", content: `${opponentName}：${entry.text}` });
    }
  }

  const turnDesc =
    state.currentSpeechMode === "both"
      ? `这是双方共同发言的回合（第 ${state.turnIndex} 回合）。${opponentName}也会同时说话，但你看不见对方的内容。`
      : `这是你单独发言的回合（第 ${state.turnIndex} 回合）。`;

  messages.push({
    role: "user",
    content: `第 ${state.roundIndex} 轮，第 ${state.turnIndex} 回合。${turnDesc}

最近对话：
${recentHistory(state, aiSide)}

现在轮到你说一句。直接输出发言内容，不要任何前缀或解释。`,
  });

  return messages;
}

/**
 * 清洗 AI 输出：去除引号、角色前缀、多余空白，截断到合理长度。
 */
export function cleanAiSpeech(raw: string): string {
  let text = raw.trim();
  // 去除包裹引号
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("「") && text.endsWith("」"))) {
    text = text.slice(1, -1).trim();
  }
  // 去除角色前缀
  text = text.replace(/^(神明之声|蛇之声|神|蛇|旁白|女人)\s*[:：]\s*/, "");
  // 去除"她说"等动作描写前缀
  text = text.replace(/^(我说|你听|听着)\s*[，,：:]\s*/, "");
  // 仅取第一句段，避免 AI 输出多段
  const firstBreak = text.search(/[\n。！？]/);
  if (firstBreak >= 0 && firstBreak < text.length) {
    // 保留到第一个句末标点（含），避免截断成半句
    const end = text.indexOf("。", firstBreak);
    if (end >= 0 && end < 80) {
      text = text.slice(0, end + 1);
    }
  }
  // 截断到 120 字以内（与输入框 maxLength=200 留余量）
  if (text.length > 120) {
    text = text.slice(0, 120);
  }
  return text.trim();
}
