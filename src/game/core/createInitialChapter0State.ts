// ============================================================
// Chapter 0 初始状态工厂
// Phase 2：无 AI 可玩闭环
// ============================================================

import { chapter0InitialState, type Chapter0State } from "@/game/types/state";

/** 创建一份全新的 Chapter 0 初始状态（深拷贝，避免引用污染） */
export function createInitialChapter0State(): Chapter0State {
  return structuredClone?.(chapter0InitialState) ??
    JSON.parse(JSON.stringify(chapter0InitialState));
}
