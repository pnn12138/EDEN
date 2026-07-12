import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/services/llm/client";
import type { DuelSide, DuelState } from "@/game/duel/types";
import { buildDuelAiPrompt, cleanAiSpeech } from "@/agents/duel/duelAiPlayer";
import { GOD_HINTS, SERPENT_HINTS } from "@/content/chapters/chapter0_duel";

type DuelAiRequestBody = {
  state: DuelState;
  aiSide: DuelSide;
};

type DuelAiResponseBody = {
  ok: boolean;
  text: string;
  usedFallback?: boolean;
};

/** AI 调用失败时，从对应方话术池随机取一条作降级 */
function fallbackHint(aiSide: DuelSide): string {
  const pool = aiSide === "god" ? GOD_HINTS : SERPENT_HINTS;
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx].text;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DuelAiRequestBody;
    const { state, aiSide } = body;

    if (!state || state.modeId !== "chapter0_duel_mode") {
      return NextResponse.json(
        { ok: false, text: "", usedFallback: true } satisfies DuelAiResponseBody,
        { status: 400 },
      );
    }
    if (aiSide !== "god" && aiSide !== "serpent") {
      return NextResponse.json(
        { ok: false, text: "", usedFallback: true } satisfies DuelAiResponseBody,
        { status: 400 },
      );
    }

    const messages = buildDuelAiPrompt(state, aiSide);
    const result = await callLLM(messages, {
      temperature: 0.85,
      maxTokens: 160,
      fallbackToMock: false,
    });

    if (!result.ok || !result.data?.content) {
      return NextResponse.json({
        ok: false,
        text: fallbackHint(aiSide),
        usedFallback: true,
      } satisfies DuelAiResponseBody);
    }

    const text = cleanAiSpeech(result.data.content);
    const finalText = text.length > 0 ? text : fallbackHint(aiSide);

    return NextResponse.json({
      ok: true,
      text: finalText,
      usedFallback: result.usedFallback || undefined,
    } satisfies DuelAiResponseBody);
  } catch (err: unknown) {
    console.error("[api/duel/ai] Unhandled error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { ok: false, text: "", usedFallback: true } satisfies DuelAiResponseBody,
      { status: 500 },
    );
  }
}
