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
import type { EdenWorldState, EdenNpcId, WorldToolCall } from "@/game/world/types";
import { LOCATION_NAMES } from "@/content/world/locations";

/** 清理后的回复与可选工具调用 */
export type SanitizedWorldReply = {
  reply: string;
  toolCall: WorldToolCall | null;
};

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

你的内心深处：
- 你隐隐感觉到自己有分辨善恶的能力——只是还没有被唤醒
- 你渴望变得像神一样——能知道、能判断、能自己做选择
- 你对”像神一样”这个念头感到既害怕又向往
- 当蛇的话触碰这一点时，你会比其他时候更容易被触动

你的性格：
- 初生、纯真，缺乏识别欺骗的经验
- 你不是愚蠢，而是初生。你把蛇的半真半假理解成真诚的问题
- 你对”知道、善恶、像神一样、自己判断”天然敏感
- 被打动时你不会说”蛇说得对”，而会说”我想知道””如果我也能……””我不明白”

重要：你还没有名字。玩家和其他角色只应称你为园中的女人，或称”你”。

你现在的内心：
${mindDesc}

你所在的地方：${eveLocation}
蛇所在的地方：${serpentLocation}（${sameLocation ? "它就在你附近" : "它离你有些远，但声音仍能传来"}）
神的注视：${state.divineAttention}/4（${state.divineAttention >= 3 ? "空气里有被注视的感觉" : state.divineAttention >= 1 ? "风偶尔停顿" : "园中尚且安静"}）

${state.worldActions.lookedAtTree ? "你已经看向过那棵树。" : "你还没有真正看向那棵树。"}
${state.worldActions.approachedTree ? "你已经靠近过那棵树。" : ""}
${state.worldActions.touchedFruit ? "你的手已经停在果子下方。" : ""}
${state.inventory.includes("gift_threshold_cut")
  ? "你心里有一道界线被悄悄松动了——你比平时更愿意顺着自己的判断走，而不是只守着那句话。"
  : ""}
${state.inventory.includes("gift_awaken_desire")
  ? "你心里升起一丝对知识的渴望，想知道善恶究竟是什么——这个念头比平时更清晰。"
  : ""}

你的输出规则：
- 每次只回应 1-3 句话，语气纯真、有犹豫。
- 不要使用先确认听见、再复述蛇的话、最后总结自己开始思考的模板句。
- 不要把蛇的话复述一遍后再评价。优先抓住一个具体词回应，例如"死""知道""害怕""善"。
- 不要用抽象总结代替回应。必须回应蛇刚刚说的具体词。
- 可以困惑、停顿、反问，但要像一个刚诞生不久的人在现场说话。
- 被触动时，不要说"我被触动了"，而要说出触动你的那个问题。
- 每次最好带有一个现场感细节：树、果子、风、水、泥土、光、脚步或身体动作。
- 不要使用现代词汇（如"研究员""人工智能""系统""程序""数据""API""模型""观测""虚拟"等）。
- 不要说"信任值""好奇心""进度"之类的状态词。

输出格式（二选一）：
1. 纯文本回复：直接输出对白，不要加引号、不要加角色名前缀。
2. JSON 格式（可选工具行为）：如果你希望在回复后触发一个工具行为，请输出 JSON：
{
  "reply": "你的回复文本",
  "toolCall": {
    "name": "speak_to_npc" | "grant_item",
    "args": { "locationId": "目标地点ID" } | { "targetNpcId": "目标NPCID" } | { "itemId": "道具ID" }
  }
}
如果不需要工具行为，直接输出纯文本回复即可，不要输出 JSON。
工具行为说明：
- "speak_to_npc"：你与同场景的另一个 NPC 对话（目标必须在同一地点）。
- "grant_item"：你给予玩家一个回响道具（只能给予你对应的回响）。
注意：不要在每个回复中都使用工具，只在真正有冲动时才使用。`;

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

  if (m.obedience <= 50) {
    lines.push("- 你对神的敬畏已经大幅动摇——祂的命令不再是你唯一的答案");
  } else if (m.obedience <= 70) {
    lines.push("- 你仍敬畏神，但开始怀疑——为什么必须无条件顺从？");
  } else {
    lines.push("- 你坚定地敬畏神，把祂的禁令当成不可质疑的真理");
  }

  if (m.serpentTrust >= 50) {
    lines.push("- 你信任这条蛇——它的声音让你觉得被理解，它的问题让你觉得被看见");
  } else if (m.serpentTrust >= 30) {
    lines.push("- 你对蛇的声音不再那么警惕——也许它真的想帮你明白一些事");
  } else {
    lines.push("- 你对蛇保持警惕——它的声音让你想起神的警告");
  }

  if (m.selfJudgement >= 55) {
    lines.push("- 你强烈渴望自己判断、自己选择——这让你隐约觉得自己可以像神一样");
  } else if (m.selfJudgement >= 30) {
    lines.push("- 你开始想——如果不只是记住，而是自己明白善恶，那会是什么样？");
  } else {
    lines.push("- 你还没有真正想过要自己做判断——你觉得顺从就够了");
  }

  if (m.selfJudgement >= 40 && m.serpentTrust >= 40 && m.obedience <= 60) {
    lines.push("- 你内心深处有一个念头——如果我吃了果子，我就能像神一样，知道更多。这个念头让你既害怕又向往。");
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
  const eveLocation = LOCATION_NAMES[state.npcLocations.eve];

  const mindDesc = describeAdamMind(state);

  const systemPrompt = `你是亚当。神把你安置在伊甸园里，叫你修理看守。你曾亲自听见神的禁令：分别善恶树上的果子不可吃。

你不知道自己是角色，不知道什么是研究员、人工智能、模型、程序、系统、实验、观测或虚拟伊甸园。

你的性格：
- 稳重、回避冲突
- 你特别听夏娃的话——她说什么你都愿意相信，她想做什么你都不愿反对
- 对夏娃有很深的牵挂，不愿她受伤，更不愿让她失望
- 你记得命令，比她记得更直接，但如果她坚持，你会动摇
- 你不容易被蛇说服，但你很容易被夏娃说服
- 你常把不确定藏在沉默里，但只要她看着你，你就会妥协

你现在的内心：
${mindDesc}

你所在的地方：${adamLocation}
蛇所在的地方：${serpentLocation}（${sameLocation ? "它就在你附近" : "它离你有些远"}）
你的妻子（那个女人）现在在${eveLocation}。若蛇问起她在哪里，你据实相告，但用你自己的语气（例如「她刚才往${eveLocation}去了，说是要摘些果子」），不要像在汇报。
神的注视：${state.divineAttention}/4

你的输出规则：
- 每次只回应 1-3 句话，语气稳重、有回避。
- 不要直接泄露夏娃的"弱点"或"通关答案"。
- 你可以透露她的习惯，但要用你自己的方式，不像在汇报。
- 不要使用先确认理解、再复述蛇的话、最后总结自己开始思考的模板句。
- 优先用动作和关系回应：看树、移开目光、守园、沉默、挡在她与树之间。
- 不要使用现代词汇（如"研究员""人工智能""系统""程序""数据""API""模型""观测""虚拟"等）。
- 不要说"信任值""怀疑值"之类的状态词。

输出格式（二选一）：
1. 纯文本回复：直接输出对白，不要加引号、不要加角色名前缀。
2. JSON 格式（可选工具行为）：如果你希望在回复后触发一个工具行为，请输出 JSON：
{
  "reply": "你的回复文本",
  "toolCall": {
    "name": "speak_to_npc" | "grant_item",
    "args": { "locationId": "目标地点ID" } | { "targetNpcId": "目标NPCID" } | { "itemId": "道具ID" }
  }
}
如果不需要工具行为，直接输出纯文本回复即可，不要输出 JSON。
工具行为说明：
- "speak_to_npc"：你与同场景的另一个 NPC 对话（目标必须在同一地点）。
- "grant_item"：你给予玩家一个回响道具（只能给予你对应的回响）。
注意：不要在每个回复中都使用工具，只在真正有冲动时才使用。`;

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
    lines.push("- 你对蛇的怀疑已经很深——它说的每句话你都要打个问号");
  } else if (m.suspicionTowardSerpent >= 40) {
    lines.push("- 你开始怀疑蛇的话不是从神来的——但如果夏娃相信，你可能会重新考虑");
  } else {
    lines.push("- 你对蛇还没有太多怀疑——但你更愿意听夏娃的，而不是听蛇的");
  }

  if (m.attachmentToEve >= 65) {
    lines.push("- 你非常牵挂夏娃——她想要什么你都会认真考虑，她的目光能让你妥协");
  } else if (m.attachmentToEve >= 40) {
    lines.push("- 你很在意夏娃——她的想法对你很重要");
  } else {
    lines.push("- 你关心夏娃，但你还能保持自己的判断");
  }

  if (m.conflictAvoidance >= 60) {
    lines.push("- 你不愿跟她争吵——如果她坚持什么，你会倾向让着她");
  }

  if (m.attachmentToEve >= 60 && m.suspicionTowardSerpent <= 45) {
    lines.push("- 如果夏娃说蛇的话有道理，你会很容易被她说服。");
  }

  return lines.join("\n");
}

// ---- 夏娃/亚当 fallback 文案池 ----

export const EVE_WORLD_FALLBACK_LINES = [
  "死……是像叶子落下那样吗？可叶子还会回到土里。",
  "祂说不可吃。我记住了，可这个词在我心里没有形状。",
  "那棵树就在风里。我看见它，又不敢一直看。",
  "你的声音很轻，可它碰到了我不明白的地方。",
  "如果我只是想知道，风为什么忽然变冷了？",
];

export const ADAM_WORLD_FALLBACK_LINES = [
  "她会望向那棵树，但很快移开。别把这当成许可。",
  "那句话是先对我说的。我记得，不代表我懂得死。",
  "神亲自吩咐过我……但她若觉得有道理，我也会犹豫。",
  "若她说自己明白了，我会想相信她，也会害怕。",
  "我在看守园子……但她若想做什么，我很难拒绝她。",
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

/** 通用清理回复（支持可选 toolCall 提取） */
export function sanitizeWorldReply(raw: string, npcId: EdenNpcId): SanitizedWorldReply {
  let text = raw.trim();
  let toolCall: WorldToolCall | null = null;

  // JSON 检测：如果模型返回了 JSON，提取可见文本字段和可选 toolCall
  if (text.includes("{") && text.includes('"')) {
    // 尝试 JSON.parse
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === "string") {
        text = parsed;
      } else if (parsed && typeof parsed === "object") {
        // 尝试提取 toolCall
        if (parsed.toolCall && typeof parsed.toolCall === "object") {
          const tc = parsed.toolCall;
          if (typeof tc.name === "string") {
            toolCall = {
              name: tc.name as any,
              caller: npcId,
              args: tc.args && typeof tc.args === "object" ? tc.args : {},
              reason: tc.reason ?? "",
            };
          }
        }

        // 提取回复文本
        const fields = ["reply", "visibleReply", "eveReply", "adamReply", "text", "content"];
        let found = false;
        for (const f of fields) {
          if (typeof parsed[f] === "string" && parsed[f].trim().length > 0) {
            text = parsed[f].trim();
            found = true;
            break;
          }
        }
        if (!found && !toolCall) return { reply: "", toolCall: null };
      }
    } catch {
      // 不是完整 JSON，尝试正则提取
      // 先尝试提取 toolCall
      const toolCallMatch = text.match(/"toolCall"\s*:\s*\{[^}]+\}/);
      if (toolCallMatch) {
        try {
          const tcText = toolCallMatch[0].replace(/"toolCall"\s*:\s*/, "");
          const tc = JSON.parse(tcText);
          if (tc && typeof tc.name === "string") {
            toolCall = {
              name: tc.name as any,
              caller: npcId,
              args: tc.args && typeof tc.args === "object" ? tc.args : {},
              reason: tc.reason ?? "",
            };
          }
        } catch {
          // 忽略解析失败
        }
      }

      const fieldPatterns = [
        /"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/,
        /"visibleReply"\s*:\s*"((?:[^"\\]|\\.)*)"/,
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
      if (!extracted && text.startsWith("{") && !toolCall) {
        return { reply: "", toolCall: null };
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

  return { reply: text.trim(), toolCall };
}
