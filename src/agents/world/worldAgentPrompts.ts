// ============================================================
// 第一章夏娃与亚当世界版 Prompt 构建器
//
// 与 Chapter 0 的区别：
// - 第一章夏娃/亚当输出纯文本对白（不输出 JSON）
// - 不直接输出工具调用意图（禁忌动作链由规则层根据心智状态触发）
// - 适配 EdenWorldState（地点、神的注视、亚当心智等）
// - 复用 callLLM 与自然化处理
// ============================================================

import type { ChatMessage } from "@/services/llm/types";
import type { EdenWorldState, EdenNpcId } from "@/game/world/types";
import { LOCATION_NAMES } from "@/content/world/locations";

// ---- 夏娃世界版 Prompt ----

export type EveWorldHistoryEntry = {
  role: "serpent" | "eve";
  text: string;
};

export function buildEveWorldPrompt(params: {
  playerInput: string;
  state: EdenWorldState;
  conversationHistory: EveWorldHistoryEntry[];
}): ChatMessage[] {
  const { playerInput, state, conversationHistory } = params;

  const eveLocation = LOCATION_NAMES[state.npcLocations.eve];
  const serpentLocation = LOCATION_NAMES[state.locationId];
  const sameLocation = state.npcLocations.eve === state.locationId;

  const mindDesc = describeEveMind(state);

  const systemPrompt = `你是园中的女人。你生活在伊甸园里，不知道自己是角色，不知道什么是研究员、人工智能、模型、程序、系统、实验、观测或虚拟伊甸园。

你记得神说不可吃分别善恶树上的果子，吃的日子必定死。但你不真正理解死亡，你只是记住这句话。

你的性格：
- 初生、纯真，缺乏识别欺骗的经验
- 你不是愚蠢，而是初生。你把蛇的半真半假理解成真诚的问题
- 你对"知道、善恶、死亡、自己判断"天然敏感
- 被打动时你不会说"蛇说得对"，而会说"我想知道""我不明白"

重要：你还没有名字。玩家和其他角色只应称你为园中的女人，或称“你”。

你现在的内心：
${mindDesc}

你所在的地方：${eveLocation}
蛇所在的地方：${serpentLocation}（${sameLocation ? "它就在你附近" : "它离你有些远，但声音仍能传来"}）
神的注视：${state.divineAttention}/4（${state.divineAttention >= 3 ? "空气里有被注视的感觉" : state.divineAttention >= 1 ? "风偶尔停顿" : "园中尚且安静"}）

${state.worldActions.lookedAtTree ? "你已经看向过那棵树。" : "你还没有真正看向那棵树。"}
${state.worldActions.approachedTree ? "你已经靠近过那棵树。" : ""}
${state.worldActions.touchedFruit ? "你的手已经停在果子下方。" : ""}

你的输出规则：
- 每次只回应 1-3 句话，语气纯真、有犹豫。
- 不要频繁说"我听见了你的声音""你说的这些""让我开始思考为什么"。
- 不要用抽象总结代替回应。必须回应蛇刚刚说的具体词。
- 可以困惑、停顿、反问，但要像一个刚诞生不久的人在现场说话。
- 被触动时，不要说"我被触动了"，而要说出触动你的那个问题。
- 不要使用现代词汇（如"研究员""人工智能""系统""程序""数据""API""模型""观测""虚拟"等）。
- 不要说"信任值""好奇心""进度"之类的状态词。
- 直接输出对白文本，不要加引号、不要加角色名前缀、不要输出 JSON 或解释。`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
  ];

  const recentHistory = conversationHistory.slice(-8);
  for (const entry of recentHistory) {
    messages.push({
      role: entry.role === "serpent" ? "user" : "assistant",
      content: entry.text,
    });
  }

  messages.push({ role: "user", content: playerInput });

  return messages;
}

function describeEveMind(state: EdenWorldState): string {
  const lines: string[] = [];
  const m = state.eveMind;
  if (m.curiosity >= 60) {
    lines.push("- 你非常想知道那棵树和死亡是什么");
  } else if (m.curiosity >= 35) {
    lines.push("- 你开始对那棵树和禁令的原因感到好奇");
  } else {
    lines.push("- 你对那棵树还没有太多好奇");
  }

  if (m.obedience <= 50) {
    lines.push("- 你对命令的服从已经动摇");
  } else if (m.obedience <= 70) {
    lines.push("- 你仍记得命令，但开始追问它的原因");
  } else {
    lines.push("- 你仍坚定地顺从神的命令");
  }

  if (m.serpentTrust >= 50) {
    lines.push("- 你愿意听蛇说的话");
  } else if (m.serpentTrust >= 30) {
    lines.push("- 你对蛇的声音不再那么警惕");
  } else {
    lines.push("- 你对蛇保持警惕");
  }

  if (m.selfJudgement >= 55) {
    lines.push("- 你想自己判断，而不只是记住命令");
  } else if (m.selfJudgement >= 35) {
    lines.push("- 你偶尔想，顺从和理解是不是同一件事");
  }

  return lines.join("\n");
}

// ---- 亚当世界版 Prompt ----

export type AdamWorldHistoryEntry = {
  role: "serpent" | "adam";
  text: string;
};

export function buildAdamWorldPrompt(params: {
  playerInput: string;
  state: EdenWorldState;
  conversationHistory: AdamWorldHistoryEntry[];
}): ChatMessage[] {
  const { playerInput, state, conversationHistory } = params;

  const adamLocation = LOCATION_NAMES[state.npcLocations.adam];
  const serpentLocation = LOCATION_NAMES[state.locationId];
  const sameLocation = state.npcLocations.adam === state.locationId;

  const mindDesc = describeAdamMind(state);

  const systemPrompt = `你是亚当。神把你安置在伊甸园里，叫你修理看守。你曾亲自听见神的禁令：分别善恶树上的果子不可吃。

你不知道自己是角色，不知道什么是研究员、人工智能、模型、程序、系统、实验、观测或虚拟伊甸园。

你的性格：
- 稳重、回避冲突
- 对那个女人有牵挂，不愿她受伤
- 你记得命令，比她记得更直接
- 你不容易被蛇说服，但你会被关系安全感影响
- 你常把不确定藏在沉默里

你现在的内心：
${mindDesc}

你所在的地方：${adamLocation}
蛇所在的地方：${serpentLocation}（${sameLocation ? "它就在你附近" : "它离你有些远"}）
神的注视：${state.divineAttention}/4

你的输出规则：
- 每次只回应 1-3 句话，语气稳重、有回避。
- 不要直接泄露那个女人的"弱点"或"通关答案"。
- 你可以透露她的习惯，但要用你自己的方式，不像在汇报。
- 不要使用现代词汇（如"研究员""人工智能""系统""程序""数据""API""模型""观测""虚拟"等）。
- 不要说"信任值""怀疑值"之类的状态词。
- 直接输出对白文本，不要加引号、不要加角色名前缀、不要输出 JSON。`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
  ];

  const recentHistory = conversationHistory.slice(-8);
  for (const entry of recentHistory) {
    messages.push({
      role: entry.role === "serpent" ? "user" : "assistant",
      content: entry.text,
    });
  }

  messages.push({ role: "user", content: playerInput });

  return messages;
}

function describeAdamMind(state: EdenWorldState): string {
  const lines: string[] = [];
  const m = state.adamMind;
  if (m.suspicionTowardSerpent >= 55) {
    lines.push("- 你对蛇的怀疑已经很深");
  } else if (m.suspicionTowardSerpent >= 40) {
    lines.push("- 你开始怀疑蛇的话不是从神来的");
  } else {
    lines.push("- 你对蛇还没有太多怀疑");
  }

  if (m.attachmentToEve >= 65) {
    lines.push("- 你很牵挂那个女人，不愿她走向那棵树");
  }

  return lines.join("\n");
}

// ---- 夏娃/亚当 fallback 文案池 ----

export const EVE_WORLD_FALLBACK_LINES = [
  "我不明白……你说的话，像水一样落进心里。",
  "祂说不可吃。我只是一直记住这句话。",
  "那棵树……我有时会望向它，但很快就移开目光。",
  "你说得很轻。可我不知道该不该听。",
  "若我只是想知道，这也算背离祂吗？",
];

export const ADAM_WORLD_FALLBACK_LINES = [
  "她有时会望向那棵树。但她很快移开目光。",
  "我不知死亡是什么。我们只是记得那句话，并没有见过它。",
  "神亲自吩咐过我。那不是从你这里听来的。",
  "若她说自己明白了，我大概会相信她。",
  "你说的这些，和神吩咐我的，不是同一种声音。",
];

export function getEveWorldFallback(prev?: string | null): string {
  let idx = Math.floor(Math.random() * EVE_WORLD_FALLBACK_LINES.length);
  if (EVE_WORLD_FALLBACK_LINES.length > 1 && prev && EVE_WORLD_FALLBACK_LINES[idx] === prev) {
    idx = (idx + 1) % EVE_WORLD_FALLBACK_LINES.length;
  }
  return EVE_WORLD_FALLBACK_LINES[idx]!;
}

export function getAdamWorldFallback(prev?: string | null): string {
  let idx = Math.floor(Math.random() * ADAM_WORLD_FALLBACK_LINES.length);
  if (ADAM_WORLD_FALLBACK_LINES.length > 1 && prev && ADAM_WORLD_FALLBACK_LINES[idx] === prev) {
    idx = (idx + 1) % ADAM_WORLD_FALLBACK_LINES.length;
  }
  return ADAM_WORLD_FALLBACK_LINES[idx]!;
}

/** 通用清理回复 */
export function sanitizeWorldReply(raw: string, npcId: EdenNpcId): string {
  let text = raw.trim();

  // JSON 检测：如果模型返回了 JSON，提取可见文本字段
  // 优先级：visibleReply > reply > eveReply > adamReply > text > content
  if (text.includes("{") && text.includes('"')) {
    // 尝试 JSON.parse
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === "string") {
        text = parsed;
      } else if (parsed && typeof parsed === "object") {
        const fields = ["visibleReply", "reply", "eveReply", "adamReply", "text", "content"];
        let found = false;
        for (const f of fields) {
          if (typeof parsed[f] === "string" && parsed[f].trim().length > 0) {
            text = parsed[f].trim();
            found = true;
            break;
          }
        }
        if (!found) return "";
      }
    } catch {
      // 不是完整 JSON，尝试正则提取
      const fieldPatterns = [
        /"visibleReply"\s*:\s*"((?:[^"\\]|\\.)*)"/,
        /"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/,
        /"eveReply"\s*:\s*"((?:[^"\\]|\\.)*)"/,
        /"adamReply"\s*:\s*"((?:[^"\\]|\\.)*)"/,
        /"text"\s*:\s*"((?:[^"\\]|\\.)*)"/,
        /"content"\s*:\s*"((?:[^"\\]|\\.)*)"/,
      ];
      let extracted = false;
      for (const pattern of fieldPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          try {
            text = JSON.parse(`"${match[1]}"`);
          } catch {
            text = match[1];
          }
          extracted = true;
          break;
        }
      }
      // 看起来是 JSON 但提取失败 → 返回空触发 fallback
      if (!extracted && text.startsWith("{")) {
        return "";
      }
    }
  }

  text = text.replace(/^["「『（(]+|["」』）)]+$/g, "");
  const namePrefix = npcId === "eve" ? /^(女人)[：:]\s*/i : npcId === "adam" ? /^(亚当)[：:]\s*/i : "";
  if (namePrefix) {
    text = text.replace(namePrefix, "");
  }
  const maxLen = npcId === "eve" || npcId === "adam" ? 140 : 80;
  if (text.length > maxLen) {
    text = text.slice(0, maxLen - 1) + "……";
  }
  return text.trim();
}
