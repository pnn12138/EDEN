"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CHAPTER0_IMAGES } from "@/game/assets";
import GardenCodex from "@/components/world/GardenCodex";
import {
  SAVE_SLOTS,
  slotKey,
  LEGACY_WORLD_STATE_KEY,
} from "@/hooks/useWorldSave";
import {
  getUnlockedCrossSessionMarkIds,
  getCollectedResonanceIds,
  getTriggeredEndingIds,
  syncFromWorldState,
} from "@/services/achievement/globalTracker";
import type { EdenWorldState } from "@/game/world/types";

/** 读取所有存档槽位（含旧单存档）中的世界状态，用于汇总已解锁印记 */
function readAllSavedWorldStates(): EdenWorldState[] {
  if (typeof window === "undefined") return [];
  const results: EdenWorldState[] = [];
  const raws: (string | null)[] = SAVE_SLOTS.map((i) =>
    window.localStorage.getItem(slotKey(i)),
  );
  raws.push(window.localStorage.getItem(LEGACY_WORLD_STATE_KEY));
  for (const raw of raws) {
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as Partial<EdenWorldState>;
      if (parsed?.chapterId === "chapter1_garden_voices" && parsed.unlockedAchievementIds) {
        results.push(parsed as EdenWorldState);
      }
    } catch {
      /* noop */
    }
  }
  return results;
}

/** 从所有游戏存档读取已解锁的印记 ID */
function readSavedUnlockedIds(): string[] {
  const ids: string[] = [];
  for (const s of readAllSavedWorldStates()) {
    if (Array.isArray(s.unlockedAchievementIds)) {
      ids.push(...s.unlockedAchievementIds);
    }
  }
  return ids;
}

export default function GardenPage() {
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const [collectedResonanceIds, setCollectedResonanceIds] = useState<string[]>([]);
  const [triggeredEndingIds, setTriggeredEndingIds] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // 用所有存档状态刷新跨局累计（如已通关）
    for (const s of readAllSavedWorldStates()) {
      syncFromWorldState(s);
    }
    const saved = readSavedUnlockedIds();
    const cross = getUnlockedCrossSessionMarkIds();
    setUnlockedIds(Array.from(new Set([...saved, ...cross])));
    setCollectedResonanceIds(getCollectedResonanceIds());
    setTriggeredEndingIds(getTriggeredEndingIds());
    setIsLoaded(true);
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
        <section
          className="eden-garden-archive"
          aria-labelledby="garden-title"
          aria-busy={!isLoaded}
        >
          <div className="eden-garden-archive-head">
            <Link href="/" className="eden-garden-back" data-testid="garden-back">
              <span aria-hidden="true">←</span> 返回首页
            </Link>

            <header className="eden-garden-header">
              <p className="eden-garden-eyebrow">THE GARDEN ARCHIVE</p>
              <h1 id="garden-title">园中档案</h1>
              <p className="eden-garden-subtitle">
                你在这座园子里留下的痕迹：印记、回响与走过的结局。有些一眼可见，有些要自己去找。
              </p>
            </header>
          </div>

          {isLoaded ? (
            <GardenCodex
              unlockedIds={unlockedIds}
              collectedResonanceIds={collectedResonanceIds}
              triggeredEndingIds={triggeredEndingIds}
            />
          ) : (
            <div className="eden-garden-loading" role="status" aria-label="正在整理园中档案">
              <span className="eden-garden-loading-line eden-garden-loading-line--wide" />
              <span className="eden-garden-loading-line" />
              <div className="eden-garden-loading-cards">
                {Array.from({ length: 4 }, (_, index) => (
                  <span key={index} className="eden-garden-loading-card" />
                ))}
              </div>
            </div>
          )}

          <p className="eden-garden-hint">
            <span aria-hidden="true">✦</span>
            未解锁的隐藏印记不会透露任何线索，它们藏在你还没走过的路上。
          </p>
        </section>
      </main>
    </div>
  );
}
