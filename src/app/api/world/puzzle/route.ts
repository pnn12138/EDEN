import { NextRequest, NextResponse } from "next/server";
import { getScenePuzzleById } from "@/content/world/scenePuzzles";
import {
  applyScenePuzzleAnswer,
  isScenePuzzleCompleted,
} from "@/game/world/puzzleRules";
import type { EdenWorldState } from "@/game/world/types";

type PuzzleRequestBody = {
  state: EdenWorldState;
  puzzleId: string;
  optionId: string;
};

export async function POST(request: NextRequest) {
  let body: PuzzleRequestBody;
  try {
    body = await request.json() as PuzzleRequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, result: null, reason: "问答请求格式无效。" },
      { status: 400 },
    );
  }

  const { state, puzzleId, optionId } = body;
  if (!state || typeof puzzleId !== "string" || typeof optionId !== "string") {
    return NextResponse.json(
      { ok: false, result: null, reason: "问答请求缺少必要信息。" },
      { status: 400 },
    );
  }

  if (
    state.chapterId !== "chapter1_garden_voices" ||
    state.phase !== "explore" ||
    state.isEnded
  ) {
    return NextResponse.json(
      { ok: false, result: null, reason: "当前状态不能回答场景问题。" },
      { status: 409 },
    );
  }

  const puzzle = getScenePuzzleById(puzzleId);
  if (!puzzle) {
    return NextResponse.json(
      { ok: false, result: null, reason: "未知的场景问题。" },
      { status: 404 },
    );
  }

  const alreadyCompleted = isScenePuzzleCompleted(state, puzzle.id);
  if (
    !alreadyCompleted &&
    (
      puzzle.locationId !== state.locationId ||
      (puzzle.timeOfDay && puzzle.timeOfDay !== state.timeOfDay)
    )
  ) {
    return NextResponse.json(
      { ok: false, result: null, reason: "需要到达对应场景后才能回答。" },
      { status: 409 },
    );
  }

  const result = applyScenePuzzleAnswer(state, puzzle, optionId);
  return NextResponse.json({ ok: true, result, reason: null });
}
