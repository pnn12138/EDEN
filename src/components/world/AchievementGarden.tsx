"use client";

// 园中印记图鉴组件（Phase 2 Task 2.3）
//
// 纯展示组件：不修改任何游戏状态，只根据传入的「已解锁印记 ID」渲染图鉴。
// 已解锁集合由上层（首页图鉴页 / 游戏内浮窗）合并：
//   本局解锁（游戏存档 unlockedAchievementIds）+ 跨局解锁（globalTracker）。
//
// 玩家可见统一称为「园中印记」，不使用「成就 / 奖杯」等元术语。

import { useEffect, useMemo, useState } from "react";
import type { Achievement, AchievementCategory } from "@/content/world/achievements";
import { ACHIEVEMENTS, getAchievementsByCategory } from "@/content/world/achievements";
import { getUnlockedAt, recordUnlockedTimes } from "@/services/achievement/globalTracker";

type AchievementGardenProps = {
  /** 已解锁的印记 ID（合并本局 + 跨局） */
  unlockedIds: string[];
  /** 紧凑模式（浮窗内渲染时减小留白） */
  compact?: boolean;
};

const CATEGORY_ORDER: AchievementCategory[] = [
  "explore",
  "interaction",
  "gameplay",
  "ending",
];

const CATEGORY_LABEL: Record<AchievementCategory, string> = {
  explore: "探索",
  interaction: "交互",
  gameplay: "玩法",
  ending: "结局",
};

type FilterMode = "all" | "unlocked" | "locked";

const ICON_BASE = "/assets/chapter1/images/achievements";

function formatUnlockTime(iso: string | undefined): string | null {
  if (!iso) return null;
  // 确定性格式（避免 SSR 本地化不一致）：YYYY-MM-DD HH:mm
  const date = iso.slice(0, 10);
  const time = iso.slice(11, 16);
  if (!date) return null;
  return time ? `${date} ${time}` : date;
}

export default function AchievementGarden({ unlockedIds, compact }: AchievementGardenProps) {
  const [activeTab, setActiveTab] = useState<AchievementCategory>("explore");
  const [filter, setFilter] = useState<FilterMode>("all");

  const unlockedSet = useMemo(() => new Set(unlockedIds), [unlockedIds]);
  const unlockedCount = useMemo(
    () => ACHIEVEMENTS.filter((a) => unlockedSet.has(a.id)).length,
    [unlockedSet],
  );

  // 记录解锁时间（首次观察时写入跨局存档）
  useEffect(() => {
    const ids = ACHIEVEMENTS.map((a) => a.id).filter((id) => unlockedSet.has(id));
    if (ids.length) recordUnlockedTimes(ids);
  }, [unlockedSet]);

  const unlockedAt = useMemo(() => getUnlockedAt(), []);

  const visibleMarks = useMemo(() => {
    const list = getAchievementsByCategory(activeTab);
    if (filter === "unlocked") return list.filter((a) => unlockedSet.has(a.id));
    if (filter === "locked") return list.filter((a) => !unlockedSet.has(a.id));
    return list;
  }, [activeTab, filter, unlockedSet]);

  return (
    <div className={`eden-achievement-garden ${compact ? "eden-achievement-garden--compact" : ""}`}>
      <div className="eden-achievement-progress">
        已解锁 <strong>{unlockedCount}</strong> / {ACHIEVEMENTS.length}
      </div>

      <div className="eden-achievement-tabs" role="tablist">
        {CATEGORY_ORDER.map((cat) => {
          const total = getAchievementsByCategory(cat).length;
          const got = getAchievementsByCategory(cat).filter((a) => unlockedSet.has(a.id)).length;
          return (
            <button
              key={cat}
              role="tab"
              aria-selected={activeTab === cat}
              className={`eden-achievement-tab ${activeTab === cat ? "eden-achievement-tab--active" : ""}`}
              onClick={() => setActiveTab(cat)}
            >
              {CATEGORY_LABEL[cat]}
              <span className="eden-achievement-tab-count">{got}/{total}</span>
            </button>
          );
        })}
      </div>

      <div className="eden-achievement-filters">
        {(
          [
            ["all", "全部"],
            ["unlocked", "已解锁"],
            ["locked", "未解锁"],
          ] as [FilterMode, string][]
        ).map(([mode, label]) => (
          <button
            key={mode}
            className={`eden-achievement-filter ${filter === mode ? "eden-achievement-filter--active" : ""}`}
            onClick={() => setFilter(mode)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="eden-achievement-grid">
        {visibleMarks.map((mark: Achievement) => {
          const unlocked = unlockedSet.has(mark.id);
          const isHiddenLocked = mark.hidden && !unlocked;

          if (isHiddenLocked) {
            return (
              <div
                key={mark.id}
                className="eden-achievement-card eden-achievement-card--hidden-locked"
                title="尚未解锁的隐藏印记"
              >
                <div className="eden-achievement-card-icon eden-achievement-card-icon--hidden">?</div>
                <p className="eden-achievement-card-name eden-achievement-card-name--hidden">？？</p>
                <p className="eden-achievement-card-desc">尚未解锁</p>
              </div>
            );
          }

          const time = formatUnlockTime(unlockedAt[mark.id]);
          return (
            <div
              key={mark.id}
              className={`eden-achievement-card ${unlocked ? "eden-achievement-card--unlocked" : "eden-achievement-card--locked"}`}
            >
              <div className="eden-achievement-card-icon">
                {/* 本地静态图标，使用 <img> 以保留 onError 兜底隐藏 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${ICON_BASE}/${mark.id}.png`}
                  alt={mark.name}
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                  }}
                />
              </div>
              <p className="eden-achievement-card-name">
                {unlocked ? "✦ " : "○ "}
                {mark.name}
              </p>
              <p className="eden-achievement-card-desc">
                {unlocked ? mark.desc : "尚未解锁"}
              </p>
              {unlocked && time && (
                <p className="eden-achievement-card-time">解锁于 {time}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
