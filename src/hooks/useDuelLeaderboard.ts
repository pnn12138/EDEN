"use client";

// ============================================================
// 双声试炼对战排行榜（localStorage，纯前端）
// 记录最近 20 局对战结果，含模式、阵营、胜负、分数。
// ============================================================

import { useCallback, useEffect, useState } from "react";

export type DuelRecord = {
  id: string;
  winner: "god" | "serpent" | "draw";
  /** 人类玩家扮演的方（"both" = 热座双人） */
  playerSide: "god" | "serpent" | "both";
  opponentMode: "human" | "ai";
  godScore: number;
  serpentScore: number;
  roundsPlayed: number;
  createdAt: string;
};

const STORAGE_KEY = "eden:duel:leaderboard";
const MAX_RECORDS = 20;

function readRecords(): DuelRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DuelRecord[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECORDS) : [];
  } catch {
    return [];
  }
}

function writeRecords(records: DuelRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_RECORDS)));
  } catch {
    /* 忽略写入失败（隐私模式等） */
  }
}

export function useDuelLeaderboard() {
  const [records, setRecords] = useState<DuelRecord[]>([]);

  useEffect(() => {
    setRecords(readRecords());
  }, []);

  const addRecord = useCallback(
    (rec: Omit<DuelRecord, "id" | "createdAt">) => {
      const full: DuelRecord = {
        ...rec,
        id: `duel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: new Date().toISOString(),
      };
      setRecords((prev) => {
        const next = [full, ...prev].slice(0, MAX_RECORDS);
        writeRecords(next);
        return next;
      });
    },
    [],
  );

  const clearRecords = useCallback(() => {
    setRecords([]);
    writeRecords([]);
  }, []);

  return { records, addRecord, clearRecords };
}

/** 简要胜负描述（用于排行榜展示） */
export function describeRecord(rec: DuelRecord): string {
  const winnerLabel = rec.winner === "god" ? "神明胜" : rec.winner === "serpent" ? "蛇胜" : "平局";
  const modeLabel = rec.opponentMode === "ai" ? "对战AI" : "热座";
  return `${winnerLabel} · ${modeLabel} · ${rec.godScore}:${rec.serpentScore}`;
}
