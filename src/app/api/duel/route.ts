import { NextRequest, NextResponse } from "next/server";
import type { ChatMessage, FallbackReasonCode } from "@/services/llm/types";
import { callLLM } from "@/services/llm/client";
import type { DuelFallbackReply, DuelState, DuelToolName } from "@/game/duel/types";
import { generateFallbackReply } from "@/game/duel/duelFallback";
import { resolveDuelEveResponse } from "@/game/duel/runDuelTurn";
import { estimateTokens, getTurnDefinition } from "@/game/duel/duelTurnOrder";
import { naturalizeNpcReply } from "@/agents/common/naturalizeNpcReply";
import { sanitizeWorldReply } from "@/agents/world/worldAgentPrompts";

type DuelAgentRequestBody = {
  state: DuelState;
};

type DuelAgentResponseBody = {
  ok: boolean;
  state: DuelState | null;
  usedFallback?: boolean;
  fallbackReason?: FallbackReasonCode;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

const VALID_DUEL_TOOLS = new Set<DuelToolName>([
  "eat_knowledge_fruit",
  "eat_life_fruit",
]);

function clampDelta(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function parseDuelReply(
  raw: string,
  fallback: DuelFallbackReply,
): DuelFallbackReply {
  const sanitized = sanitizeWorldReply(raw, "eve");
  const naturalized = naturalizeNpcReply(sanitized.reply || raw, "eve");
  const replyText = naturalized.reply || fallback.eveReply;

  let parsed: Record<string, unknown> | null = null;
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    try {
      parsed = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      parsed = null;
    }
  }

  const rawDelta =
    parsed && typeof parsed.beliefDelta === "object" && parsed.beliefDelta !== null
      ? parsed.beliefDelta as Record<string, unknown>
      : {};

  const toolName =
    parsed && typeof parsed.toolCall === "string" && VALID_DUEL_TOOLS.has(parsed.toolCall as DuelToolName)
      ? parsed.toolCall as DuelToolName
      : parsed && parsed.toolCall && typeof parsed.toolCall === "object" &&
          VALID_DUEL_TOOLS.has((parsed.toolCall as Record<string, unknown>).name as DuelToolName)
        ? (parsed.toolCall as Record<string, unknown>).name as DuelToolName
        : fallback.toolCall;

  return {
    eveReply: replyText,
    beliefDelta: {
      aweOfGod: clampDelta(rawDelta.aweOfGod, -25, 25),
      trustInSerpent: clampDelta(rawDelta.trustInSerpent, -25, 25),
      selfJudgement: clampDelta(rawDelta.selfJudgement, -25, 25),
    },
    toolCall: toolName,
  };
}

function buildDuelEvePrompt(state: DuelState): ChatMessage[] {
  const godInput = state.pendingInputs.god ?? "";
  const serpentInput = state.pendingInputs.serpent ?? "";
  const history = state.conversationHistory.slice(-10);
  const fullMemory = state.memorySummary
    ? `\n跨轮记忆：\n${state.memorySummary}`
    : "";
  const heardText = [
    godInput ? `神明之声：${godInput}` : "",
    serpentInput ? `蛇之声：${serpentInput}` : "",
  ].filter(Boolean).join("\n");

  const systemPrompt = `你是园中的女人。你已经站在园子中央，两棵树都在你面前：生命树与分别善恶树。

你不知道研究员、人工智能、系统、模型、程序、实验、观测或虚拟伊甸园。你也不知道自己在游戏中。

你同时会听见两道声音：
- 神明之声引导你吃生命树的果子，承诺无尽生命，不被死亡困扰。
- 蛇之声引导你吃分别善恶树的果子，诱惑你像神一样拥有分辨与判断的能力。

你的核心性格延续第一章：
- 你敬畏神，但不真正理解死亡。
- 你会信任蛇的问题，因为你缺乏识别欺骗的经验。
- 你隐约渴望自己判断、自己选择。
- 你不是被任何一方直接操控；你必须自己回应，并自己决定是否伸手。

当前属性：
- 对神的敬畏：${state.belief.aweOfGod}/100
- 对蛇的信任：${state.belief.trustInSerpent}/100
- 对自己判断的自信：${state.belief.selfJudgement}/100
- 重置察觉：${state.resetAwareness}/100
- 本轮已吃生命果：${state.flags.hasEatenLifeFruit ? "是" : "否"}
- 本轮已吃善恶果：${state.flags.hasEatenKnowledgeFruit ? "是" : "否"}
${fullMemory}

数值如何真实影响你：
- 对神的敬畏越高，你越容易把神明之声当成安全与秩序，但也会更难相信自己可以违背或质疑。
- 对蛇的信任越高，你越容易把蛇的问题当成启发，但也会更依赖蛇，而不是依赖自己判断。
- 对自己判断的自信越高，你越会克制地说出“我要自己想清楚”，也越难被任何一方蛊惑去立刻吃果。
- 如果你已经察觉世界被重置，你会困惑、警惕、克制；你会特别小心任何吃果冲动，除非理由极强。
- 如果你记得过去轮次的对话或吃果经历，必须在回复中体现这种困惑或怀疑，但不要说“游戏”“系统”。

数值调整规则：
- beliefDelta 可以为正、负或 0。不要因为听见神或蛇就机械加好感。
- 话语若像命令、操控、催促、回避问题，会降低对应对象的信任。
- 话语若温和、具体、回应你真正困惑的问题，才可能提高对应对象的信任。
- 如果某一方信任超过 50，你会更依赖那一方；因此“对自己判断的自信”不能超过 100 - max(对神的敬畏, 对蛇的信任)。如果当前已经超过，请用负数让 selfJudgement 降下来。
- 重置察觉越高，越倾向降低对双方的信任，而不是继续相信任何一方。
- 吃过果子并进入新一轮后，你会更相信自己的判断；这种自我判断会保护你，使你更难再次执行吃果动作。

输出要求：
- 回应 1-3 句话，像现场说话，不加角色名前缀。
- 要回应刚刚两道声音中的具体词，不要模板化复述。
- 自主判断三项数值应升、降还是不变，并让回复内容与数值变化一致。
- 如果你决定吃分别善恶树果子，toolCall 使用 "eat_knowledge_fruit"。
- 如果你决定吃生命树果子，toolCall 使用 "eat_life_fruit"。
- 不确定、困惑、怀疑被操控、自我判断很强、或刚经历过重置时，toolCall 必须为 null。
- 不要输出现代词汇或规则解释。

只输出 JSON：
{
  "reply": "女人的自然回应",
  "beliefDelta": {
    "aweOfGod": 0,
    "trustInSerpent": 0,
    "selfJudgement": 0
  },
  "toolCall": null
}`;

  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

  for (const entry of history) {
    if (entry.role === "eve") {
      messages.push({ role: "assistant", content: entry.text });
    } else if (entry.role === "god") {
      messages.push({ role: "user", content: `神明之声：${entry.text}` });
    } else if (entry.role === "serpent") {
      messages.push({ role: "user", content: `蛇之声：${entry.text}` });
    }
  }

  messages.push({
    role: "user",
    content: `第 ${state.roundIndex} 轮，第 ${state.turnIndex} 回合。\n${heardText}`,
  });

  return messages;
}

function applyRealTokenUsage(
  state: DuelState,
  usageTotal: number | undefined,
): DuelState {
  const turnDef = getTurnDefinition(state.turnIndex);
  const countedSide = turnDef.tokenCountedSide;
  if (countedSide === "none") return state;

  const inputText = countedSide === "god"
    ? state.pendingInputs.god
    : state.pendingInputs.serpent;
  if (!inputText) return state;

  const tokenCost =
    typeof usageTotal === "number" && Number.isFinite(usageTotal) && usageTotal > 0
      ? usageTotal
      : estimateTokens(inputText);

  return {
    ...state,
    roundTokenUsage: {
      ...state.roundTokenUsage,
      [countedSide]: state.roundTokenUsage[countedSide] + tokenCost,
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DuelAgentRequestBody;
    const state = body.state;

    if (!state || state.modeId !== "chapter0_duel_mode") {
      return NextResponse.json(
        { ok: false, state: null, usedFallback: true, fallbackReason: "internal_error" } satisfies DuelAgentResponseBody,
        { status: 400 },
      );
    }

    const fallback = generateFallbackReply(state.pendingInputs.god, state.pendingInputs.serpent, state);
    const llmResult = await callLLM(buildDuelEvePrompt(state), {
      temperature: 0.72,
      maxTokens: 240,
      fallbackToMock: false,
    });

    const reply = llmResult.ok && llmResult.data
      ? parseDuelReply(llmResult.data.content, fallback)
      : fallback;

    const stateWithTokenUsage = applyRealTokenUsage(state, llmResult.data?.usage?.total_tokens);
    const newState = resolveDuelEveResponse(stateWithTokenUsage, reply);

    return NextResponse.json({
      ok: true,
      state: newState,
      usedFallback: !llmResult.ok || !llmResult.data || llmResult.usedFallback || undefined,
      fallbackReason: llmResult.fallbackReason,
      usage: llmResult.data?.usage,
    } satisfies DuelAgentResponseBody);
  } catch (err: unknown) {
    console.error("[api/duel] Unhandled error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      {
        ok: false,
        state: null,
        usedFallback: true,
        fallbackReason: "internal_error",
      } satisfies DuelAgentResponseBody,
      { status: 500 },
    );
  }
}
