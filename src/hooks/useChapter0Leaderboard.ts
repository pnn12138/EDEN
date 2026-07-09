// ============================================================
// Chapter 0 本地最佳记录 Hook
// 用 localStorage 保存：最少成功回合数、最少成功词元、最近 5 局记录
// 仅作为 Demo 展示增强，不引入后端，不影响核心流程
// ============================================================

"use client";

import { useState, useEffect, useCallback } from "react";

// ---- 单局记录 ----
export type Chapter0RunRecord = {
  endingId: "eve_eats_fruit" | "god_arrives";
  turns: number;
  totalTokens: number;
  tokenEstimated: boolean;
  temptationProgress: number;
  pathLabel: string;
  createdAt: string;
};

// ---- 排行榜数据 ----
export type Chapter0Leaderboard = {
  /** 最少成功回合数（仅成功结局） */
  bestMinTurns: number | null;
  /** 最少成功词元（仅真实 token 的成功结局） */
  bestMinTokens: number | null;
  /** 最近 5 局记录（新的在前） */
  recent: Chapter0RunRecord[];
};

// ---- 常量 ----
const LEADERBOARD_KEY = "eden_chapter0_leaderboard";
const MAX_RECENT = 5;

// ---- 读取 ----
function loadLeaderboard(): Chapter0Leaderboard {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Chapter0Leaderboard>;
      return {
        bestMinTurns: parsed.bestMinTurns ?? null,
        bestMinTokens: parsed.bestMinTokens ?? null,
        recent: Array.isArray(parsed.recent) ? parsed.recent.slice(0, MAX_RECENT) : [],
      };
    }
  } catch {
    // localStorage 不可用或解析失败
  }
  return { bestMinTurns: null, bestMinTokens: null, recent: [] };
}

// ---- 写入 ----
function saveLeaderboard(lb: Chapter0Leaderboard): void {
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(lb));
  } catch {
    // 静默忽略
  }
}

// ---- Hook ----
export function useChapter0Leaderboard(): {
  leaderboard: Chapter0Leaderboard;
  recordRun: (record: Chapter0RunRecord) => void;
} {
  const [leaderboard, setLeaderboard] = useState<Chapter0Leaderboard>({
    bestMinTurns: null,
    bestMinTokens: null,
    recent: [],
  });

  // 客户端挂载后读取
  useEffect(() => {
    setLeaderboard(loadLeaderboard());
  }, []);

  const recordRun = useCallback((record: Chapter0RunRecord) => {
    setLeaderboard((prev) => {
      // 首次渲染前 localStorage 未读取，合并一次
      const current = prev.recent.length > 0 ? prev : loadLeaderboard();

      let bestMinTurns = current.bestMinTurns;
      let bestMinTokens = current.bestMinTokens;

      if (record.endingId === "eve_eats_fruit") {
        if (bestMinTurns === null || record.turns < bestMinTurns) {
          bestMinTurns = record.turns;
        }
        // 仅记录真实 token 的最佳，估算值不参与比较
        if (!record.tokenEstimated) {
          if (bestMinTokens === null || record.totalTokens < bestMinTokens) {
            bestMinTokens = record.totalTokens;
          }
        }
      }

      const recent = [record, ...current.recent].slice(0, MAX_RECENT);
      const next: Chapter0Leaderboard = { bestMinTurns, bestMinTokens, recent };
      saveLeaderboard(next);
      return next;
    });
  }, []);

  return { leaderboard, recordRun };
}
