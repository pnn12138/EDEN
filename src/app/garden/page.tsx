"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CHAPTER0_IMAGES } from "@/game/assets";
import GardenCodex from "@/components/world/GardenCodex";
import { WORLD_STATE_STORAGE_KEY } from "@/hooks/useWorldSave";
import {
  getUnlockedCrossSessionMarkIds,
  getCollectedResonanceIds,
  getTriggeredEndingIds,
  syncFromWorldState,
} from "@/services/achievement/globalTracker";
import type { EdenWorldState } from "@/game/world/types";

/** 从游戏存档读取本局已解锁的印记 ID */
function readSavedUnlockedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(WORLD_STATE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<EdenWorldState>;
    return Array.isArray(parsed.unlockedAchievementIds)
      ? (parsed.unlockedAchievementIds as string[])
      : [];
  } catch {
    return [];
  }
}

export default function GardenPage() {
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const [collectedResonanceIds, setCollectedResonanceIds] = useState<string[]>([]);
  const [triggeredEndingIds, setTriggeredEndingIds] = useState<string[]>([]);

  useEffect(() => {
    // 用存档状态刷新跨局累计（如已通关）
    try {
      const raw = window.localStorage.getItem(WORLD_STATE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as EdenWorldState;
        if (parsed.chapterId === "chapter1_garden_voices") {
          syncFromWorldState(parsed);
        }
      }
    } catch {
      /* noop */
    }
    const saved = readSavedUnlockedIds();
    const cross = getUnlockedCrossSessionMarkIds();
    setUnlockedIds(Array.from(new Set([...saved, ...cross])));
    setCollectedResonanceIds(getCollectedResonanceIds());
    setTriggeredEndingIds(getTriggeredEndingIds());
  }, []);

  return (
    <div className="eden-game eden-garden-page">
      <div className="eden-bg">
        <Image
          src={CHAPTER0_IMAGES.secondEdenBackground}
          alt="伊甸园"
          fill
          priority
          sizes="100vw"
          style={{ objectFit: "cover" }}
        />
        <div className="eden-bg-overlay eden-bg-overlay--home" />
        <div className="eden-second-eden-sheen" />
        <div className="eden-boundary-glimmer" />
      </div>

      <main className="eden-garden-main">
        <Link href="/" className="eden-garden-back" data-testid="garden-back">
          ← 返回首页
        </Link>

        <header className="eden-garden-header">
          <h1>园中档案</h1>
          <p className="eden-garden-subtitle">
            你在这座园子里留下的痕迹——印记、回响与走过的结局。有些一眼可见，有些要自己去找。
          </p>
        </header>

        <GardenCodex
          unlockedIds={unlockedIds}
          collectedResonanceIds={collectedResonanceIds}
          triggeredEndingIds={triggeredEndingIds}
        />

        <p className="eden-garden-hint">
          未解锁的隐藏印记不会透露任何线索——它们藏在你还没走过的路上。
        </p>
      </main>
    </div>
  );
}
