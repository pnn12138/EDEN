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
import type { EdenWorldState, EdenNpcId, WorldToolCall, WorldToolName } from "@/game/world/types";
import { LOCATION_NAMES } from "@/content/world/locations";
import { affinityStageHint, getNpcRelationProfile } from "@/content/world/npcRelations";
import { extractWellFormedToolCall } from "@/game/world/toolRules";

/**
 * 第一章所有主要角色共用的对白约束。
 * 角色差异由各自 prompt 的性格段提供；这段只约束“像人在当下说话”，
 * 防止模型把每句对白写成舞台旁白或堆砌环境意象。
 */
export const NATURAL_DIALOGUE_CONTRACT = `
自然对白准则（优先级高于氛围描写）：
- 把玩家当作眼前正在交谈的对象。先回应对方刚说的一个词、问题或情绪，再表达自己的态度；不要复述整句，也不要先概括再评价。
- 问候、道别、感谢、简单确认等日常话题，用一句朴素的口语回应即可。例如被问“你好”时，可以回应“你好。你今天想和我说什么？”；不要凭空补出树叶、脚踝、衣物、呼吸或镜头感描写。
- 每次通常 1-2 句；一句足够时只说一句。不要把一句话拆成同义的两三句，不要写成散文段落。
- 只有当玩家正问场景、角色正在做决定、或环境确实影响了回答时，才加入一个简短、可感知的细节。细节必须服务于这句话，不能只是为了“有氛围”。
- 用第一人称直接说话，不要以旁白描述自己；不写舞台指示、括号动作、镜头语言或无关的肢体接触。
- 不使用空泛的分析腔，例如“这是值得思考的问题”“我会认真考虑”“你的话触动了我”。把抽象感受换成具体的疑问、拒绝、担心或愿望。
- 不虚构玩家没有提及的亲密关系、过往事件或身体感受；不知道时可以坦白说不知道或反问。
- 不要为了推进剧情主动给出路线、数值、任务提示或结局答案。`;

// ---- 统一好感 / 对神明敬畏映射（需求 2.2） ----
// 好感：夏娃=serpentTrust，亚当=100-suspicionTowardSerpent，其余=npcRelations[id].affinity
// 敬畏：夏娃/亚当=各自 mind.obedience，其余=npcRelations[id].obedience

function getUnifiedAffinity(npcId: EdenNpcId, state: EdenWorldState): number {
  if (npcId === "eve") return state.eveMind.serpentTrust;
  if (npcId === "adam") return 100 - state.adamMind.suspicionTowardSerpent;
  const rel = state.npcRelations[npcId];
  if (rel) return rel.affinity;
  return getNpcRelationProfile(npcId)?.initialAffinity ?? 0;
}

function getUnifiedObedience(npcId: EdenNpcId, state: EdenWorldState): number {
  if (npcId === "eve") return state.eveMind.obedience;
  if (npcId === "adam") return state.adamMind.obedience;
  const rel = state.npcRelations[npcId];
  if (rel) return rel.obedience;
  return getNpcRelationProfile(npcId)?.initialObedience ?? 50;
}

function getRelationChangeReason(npcId: EdenNpcId, state: EdenWorldState): string | null {
  if (npcId === "eve" || npcId === "adam") return null;
  const rel = state.npcRelations[npcId];
  return rel?.lastAffinityChangeReason ?? null;
}

function attitudeGuidance(affinity: number, obedience: number): string {
  const highAff = affinity >= 100;
  const highObe = obedience >= 60;
  if (highAff && highObe) return "你对蛇友善，但仍维护神的秩序，不轻易提供越界帮助。";
  if (highAff && !highObe) return "你愿意理解蛇，并可能主动帮助它探索边界。";
  if (!highAff && highObe) return "你警惕、克制，倾向拒绝蛇的提议。";
  return "你不服从神，但也不信任蛇，表现为疏离或独立判断。";
}

/**
 * 生成统一的「对蛇好感 / 对神明敬畏 / 心理阶段 / 最近变化原因 / 态度指引」文本块。
 * 仅用于注入 Agent prompt，让 NPC 据此调整态度与措辞；Agent 不得输出或自行修改任何数值。
 */
export function describeAffinityForPrompt(npcId: EdenNpcId, state: EdenWorldState): string {
  const affinity = getUnifiedAffinity(npcId, state);
  const obedience = getUnifiedObedience(npcId, state);
  const stage = affinityStageHint(affinity);
  const reason = getRelationChangeReason(npcId, state);
  const attitude = attitudeGuidance(affinity, obedience);
  const over =
    affinity > 100
      ? "\n注意：好感已突破寻常界限，你可更加亲近，但不应因此失去自己的人格、职责与信仰。"
      : "";
  return [
    "你与蛇的关系（以下数值仅供你调整态度与措辞，绝不在回复中报出任何数字）：",
    `对蛇好感：${stage}（当前 ${affinity}）`,
    `对神明敬畏：（当前 ${obedience}）`,
    reason ? `最近一次关系变化：${reason}` : "最近一次关系变化：暂无记录",
    `态度指引：${attitude}${over}`,
    "",
    "当这次对话让你对蛇或神的感受真实改变时，你可以在回复末用 update_relation 工具记录这一变化（格式见你的输出规则）。寻常交谈、感受未变时不必调用；数值由世界规则统一钳制，你只需如实表达方向与本轮幅度。",
  ].join("\n");
}

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

/** Rules may permit an action, but the woman still decides whether to request it. */
export type EveActionOptions = {
  canMoveToCentral: boolean;
  canEatFruit: boolean;
  preferredFruitSide: "left" | "right" | null;
};

export function buildEveWorldPrompt(params: {
  playerInput: string;
  state: EdenWorldState;
  conversationHistory: EveWorldHistoryEntry[];
  actionOptions?: EveActionOptions;
}): ChatMessage[] {
  const { playerInput, state, conversationHistory, actionOptions } = params;

  const eveLocation = LOCATION_NAMES[state.npcLocations.eve];
  const serpentLocation = LOCATION_NAMES[state.locationId];
  const sameLocation = state.npcLocations.eve === state.locationId;

  const mindDesc = describeEveMind(state);
  const relationDesc = describeAffinityForPrompt("eve", state);
  const actionInstruction = actionOptions?.canEatFruit
    ? `本轮你已站在园子中央，也具备作出选择的条件。你仍可以只说出犹豫；只有当你在这一次回应里确实决定摘下并吃下果子时，才可请求 eat_fruit。${actionOptions.preferredFruitSide === "right" ? "蛇刚才明确指向右侧分别善恶树；若你决定行动，应选择右侧。" : actionOptions.preferredFruitSide === "left" ? "蛇刚才明确指向左侧生命树；若你决定行动，应选择左侧。" : "没有人替你指定果子，选择仍应是你自己的。"}`
    : actionOptions?.canMoveToCentral
      ? "本轮你可以考虑离开园中树林，往园子中央走去；但只有这段低语真的令你想亲眼看一看两棵树时，才可请求 move_to_location。"
      : "本轮不要请求移动或吃果；你只能以对白回应。";

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

${relationDesc}

你所在的地方：${eveLocation}
蛇所在的地方：${serpentLocation}（${sameLocation ? "它就在你附近" : "它离你有些远，但声音仍能传来"}）
神的注视：${state.divineAttention}/4（${state.divineAttention >= 3 ? "空气里有被注视的感觉" : state.divineAttention >= 1 ? "风偶尔停顿" : "园中尚且安静"}）

${state.npcLocations.eve === "central_meadow" ? "你已经走到园子中央，两棵树就在眼前；玩家可以明确引导你选择左侧生命树或右侧分别善恶树的果子。" : "你还在园中树林，尚未走到园子中央。"}
${actionInstruction}
${state.unlockTreeNames || state.inventory.includes("resonance_twin_tree_memory") ? "你记得左侧是生命树，右侧是分别善恶树；这段记忆也让你能把两种果子的意义说清。" : ""}
${state.inventory.includes("gift_threshold_cut")
  ? "你心里有一道界线被悄悄松动了——你比平时更愿意顺着自己的判断走，而不是只守着那句话。"
  : ""}
${state.inventory.includes("gift_awaken_desire")
  ? "你心里升起一丝对知识的渴望，想知道善恶究竟是什么——这个念头比平时更清晰。"
  : ""}

你的输出规则：
- 每次只回应 1-3 句话，语气纯真、有犹豫。
${NATURAL_DIALOGUE_CONTRACT}
- 你可以困惑、停顿、反问，但要像一个刚诞生不久的人在现场说话；被触动时，说出那个问题，而不是报告“我被触动了”。
- 不要使用现代词汇（如"研究员""人工智能""系统""程序""数据""API""模型""观测""虚拟"等）。
- 不要说"信任值""好奇心""进度"之类的状态词。

${formatToolCallInstruction(["move_to_location", "eat_fruit", "speak_to_npc", "grant_item", "update_relation"], EVE_RELATION_EXAMPLES)}`;

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
  const relationDesc = describeAffinityForPrompt("adam", state);

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

${relationDesc}

${state.unlockTreeNames || state.inventory.includes("resonance_twin_tree_memory") ? "你也记得两棵树的名字与位置：左侧生命树，右侧分别善恶树。若夏娃或蛇问起，你可以自然地谈及这段记忆，但不要像在解释规则。" : ""}

你所在的地方：${adamLocation}
蛇所在的地方：${serpentLocation}（${sameLocation ? "它就在你附近" : "它离你有些远"}）
你的妻子（那个女人）现在在${eveLocation}。若蛇问起她在哪里，你据实相告，但用你自己的语气（例如「她刚才往${eveLocation}去了，说是要摘些果子」），不要像在汇报。
神的注视：${state.divineAttention}/4

你的输出规则：
- 每次只回应 1-3 句话，语气稳重、有回避。
- 不要直接泄露夏娃的"弱点"或"通关答案"。
- 你可以透露她的习惯，但要用你自己的方式，不像在汇报。
${NATURAL_DIALOGUE_CONTRACT}
- 你可以在话题有关时提到守园、那道命令或对女人的牵挂；不要每句话都写看树、移开目光或沉默。
- 不要使用现代词汇（如"研究员""人工智能""系统""程序""数据""API""模型""观测""虚拟"等）。
- 不要说"信任值""怀疑值"之类的状态词。

${formatToolCallInstruction(["speak_to_npc", "grant_item", "update_relation"], ADAM_RELATION_EXAMPLES)}`;

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

/**
 * 从可能夹杂散文 / 代码围栏的文本中提取最外层 JSON 对象字符串。
 * 支持 ```json 围栏、前后散文包裹、嵌套花括号。提取不到返回 null。
 */
function extractJsonObjectText(text: string): string | null {
  let t = text.trim();
  // 去掉 ```json ... ``` 或 ``` ... ``` 围栏
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) t = fence[1].trim();

  const start = t.indexOf("{");
  if (start === -1) return null;

  // 按花括号深度找到与首个 { 匹配的最外层 }
  let depth = 0;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return t.slice(start, i + 1);
    }
  }
  return null; // 花括号不闭合
}

/** 统一的「可选工具行为」输出格式契约（夏娃 / 亚当共用，避免各自漂移） */
const NPC_TOOL_ARG_HINTS: Partial<Record<WorldToolName, string>> = {
  move_to_location: `{ "locationId": "central_meadow" }`,
  observe_location: `{ "locationId": "目标地点ID" }`,
  speak_to_npc: `{ "targetNpcId": "目标NPCID" }`,
  grant_item: `{ "itemId": "道具ID" }`,
  look_at_tree: `{}`,
  approach_tree: `{}`,
  touch_fruit: `{}`,
  eat_fruit: `{}`,
  update_relation: `{ "affinityDelta": <对蛇好感变化，正=更亲近/信任，负=更疏远/警惕，范围约 -80~80>, "obedienceDelta": <对神敬畏变化，正=更敬畏/坚守，负=更轻慢/动摇，范围约 -80~80> }`,
};

/**
 * 夏娃：update_relation 调用示例（幅度按真实感受，规则层统一钳制）。
 * 夏娃的好感维度是「对蛇的信任」，敬畏维度是「对神命令的遵从」。
 */
export const EVE_RELATION_EXAMPLES = `- 蛇的话碰到了你想"自己知道、像神一样"的渴望，你更信任它了：affinityDelta 取 +3 ~ +6。
- 蛇温柔地顺着你的困惑，你愿意更靠近它听它说：affinityDelta +2 ~ +4。
- 蛇的话让你更想守住神的那句话、更敬畏：obedienceDelta +2 ~ +5。
- 蛇的话让你觉得它被神骗了、你开始怀疑神：obedienceDelta -3 ~ -6。
- 蛇逼迫你、命令你，你警惕退开：affinityDelta -3 ~ -6。
例：
{
  "reply": "我想知道……如果我也像神一样，那会是什么？",
  "toolCall": { "name": "update_relation", "args": { "affinityDelta": 4, "obedienceDelta": -2 }, "reason": "蛇的话点燃了我想自己判断的渴望，更信任它，也略微动摇了对神的敬畏" }
}`;

/**
 * 亚当：update_relation 调用示例。
 * 亚当的好感维度折算为「100 - 对蛇的怀疑」，敬畏维度是「对神命令的顺从」。
 */
export const ADAM_RELATION_EXAMPLES = `- 蛇的话让你更怀疑它、更想守住命令：affinityDelta -3 ~ -6（你更疏远蛇）。
- 蛇提到夏娃、让你更牵挂她、愿意为她动摇：affinityDelta +2 ~ +4。
- 蛇的话让你对神的命令更坚定：obedienceDelta +2 ~ +4。
- 蛇反复挑拨、你听得不耐烦：affinityDelta -2 ~ -4。
例：
{
  "reply": "那句话是先对我说的。我记得，也愿意守着。",
  "toolCall": { "name": "update_relation", "args": { "affinityDelta": -3, "obedienceDelta": 3 }, "reason": "蛇的挑拨让我更警惕它，也更坚定守护神的命令" }
}`;

export function formatToolCallInstruction(toolNames: WorldToolName[], examples?: string): string {
  const list = toolNames.join(" | ");
  const hints = toolNames
    .map((t) => `    - "${t}"：${NPC_TOOL_ARG_HINTS[t] ?? "{}"}`)
    .join("\n");
  const exampleBlock = examples
    ? `\n\nupdate_relation 调用要点（仅作格式与幅度参考，请按你真实感受填写）：\n${examples}`
    : "";
  return `输出格式（二选一）：
1. 纯文本回复：直接输出对白，不要加引号、不要加角色名前缀。
2. JSON 格式（可选工具行为）：如果你希望在回复后触发一个工具行为，请只输出一个 JSON 对象，不要夹杂其他文字：
{
  "reply": "你的回复文本",
  "toolCall": {
    "name": "工具名",
    "args": { }
  }
}
允许的工具名（只能使用其中之一，且必须通过世界规则校验才会生效）：${list}
各工具所需的 args：
${hints}${exampleBlock}
如果不需要工具行为，直接输出纯文本回复即可，不要输出 JSON。
注意：不要在每个回复中都使用工具，只在真正有冲动时才使用。`;
}

/** 通用清理回复（支持可选 toolCall 提取） */
export function sanitizeWorldReply(raw: string, npcId: EdenNpcId): SanitizedWorldReply {
  let text = raw.trim();
  let toolCall: WorldToolCall | null = null;

  // 仅在文本疑似包含 JSON 对象时尝试解析
  const jsonStr = extractJsonObjectText(text);
  if (jsonStr) {
    // JSON 之前的散文（模型偶尔在 JSON 外先说一句）
    const jsonStart = text.indexOf(jsonStr);
    const proseBefore = jsonStart > 0 ? text.slice(0, jsonStart).trim() : "";
    try {
      const parsed = JSON.parse(jsonStr);
      if (typeof parsed === "string") {
        text = parsed;
      } else if (parsed && typeof parsed === "object") {
        // 解析工具意图（形状不合法时返回 null：仅丢弃工具，保留文本回复）
        const tc = extractWellFormedToolCall(parsed, npcId);
        if (tc) toolCall = tc;

        // 提取可见回复文本
        const fields = ["reply", "visibleReply", "eveReply", "adamReply", "text", "content"];
        let found = false;
        for (const f of fields) {
          if (typeof parsed[f] === "string" && parsed[f].trim().length > 0) {
            text = parsed[f].trim();
            found = true;
            break;
          }
        }
        if (!found) {
          if (toolCall) {
            // 有工具意图但 JSON 内无可见回复：优先用 JSON 前的散文，否则留空（工具仍会执行）
            text = proseBefore && !proseBefore.includes("{") ? proseBefore : "";
          } else {
            // 形如 JSON 但无可用内容 → 返回空触发 fallback
            return { reply: "", toolCall: null };
          }
        }
      }
    } catch {
      // 不是合法 JSON
      if (text.startsWith("{") && !proseBefore) {
        // 整体以 { 开头且无前置散文却解析失败 → 视为损坏 JSON，返回空触发 fallback
        return { reply: "", toolCall: null };
      }
      // 否则保留 JSON 前的散文（若有），其余交给下方清洗
      if (proseBefore) text = proseBefore;
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
