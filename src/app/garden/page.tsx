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
import { readEndingReviewArchive, type EndingReviewArchiveRecord } from "@/lib/endingReviewArchive";

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

/** 从所有游戏存档读取已解锁的「园中律则」ID（按真实注视事件解锁） */
function readSavedUnlockedRuleIds(): string[] {
  const ids: string[] = [];
  for (const s of readAllSavedWorldStates()) {
    if (Array.isArray(s.unlockedDivineAttentionRuleIds)) {
      ids.push(...s.unlockedDivineAttentionRuleIds);
    }
  }
  return ids;
}

export default function GardenPage() {
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const [collectedResonanceIds, setCollectedResonanceIds] = useState<string[]>([]);
  const [triggeredEndingIds, setTriggeredEndingIds] = useState<string[]>([]);
  const [unlockedRuleIds, setUnlockedRuleIds] = useState<string[]>([]);
  const [endingReviews, setEndingReviews] = useState<EndingReviewArchiveRecord[]>([]);
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
    setUnlockedRuleIds(Array.from(new Set(readSavedUnlockedRuleIds())));
    setEndingReviews(readEndingReviewArchive());
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
              unlockedRuleIds={unlockedRuleIds}
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

          {isLoaded && (
            <section className="eden-garden-review-history" aria-labelledby="garden-review-history-title">
              <h2 id="garden-review-history-title">历次复盘</h2>
              {endingReviews.length > 0 ? (
                <div className="eden-garden-review-history-list">
                  {endingReviews.map((record) => (
                    <Link key={record.id} href={`/world?review=${encodeURIComponent(record.id)}`} className="eden-garden-review-history-card">
                      <span>{endingLabel(record.endingId)}</span>
                      <small>第 {record.timeSlot}/12 时段 · {new Date(record.savedAt).toLocaleString("zh-CN")}</small>
                      <b>查看复盘 →</b>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="eden-garden-review-history-empty">尚未留下结局复盘。完成一局后，它会留在这里。</p>
              )}
            </section>
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

function endingLabel(endingId: EndingReviewArchiveRecord["endingId"]): string {
  const labels: Record<EndingReviewArchiveRecord["endingId"], string> = {
    eve_eats_fruit: "她吃下了果子",
    god_arrives: "神降临了",
    life_fruit: "生命果的回甘",
    escape_eden: "园外的清晨",
    michael_slay: "剑下之责",
    lucifer_awaken: "被命名之前",
  };
  return labels[endingId] ?? "园中的结局";
}
