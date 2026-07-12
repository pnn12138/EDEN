"use client";

// 园中回响图鉴分页：展示全部回响道具，按来源分组，标记是否获得过。
// 数据：EDEN_ITEMS 全量 + 跨局累计 collectedResonanceIds（含本局 inventory 已同步）。

import { useMemo } from "react";
import { EDEN_ITEMS } from "@/content/world/items";
import type { ResonanceSourceType, WorldItem, WorldItemKind } from "@/content/world/items";

type ItemsGalleryProps = {
  /** 跨局累计获得过的回响 ID（合并本局 inventory） */
  collectedIds: string[];
};

const SOURCE_ORDER: ResonanceSourceType[] = ["angel", "character", "scene", "divine"];

const SOURCE_LABEL: Record<ResonanceSourceType, string> = {
  angel: "天使回响",
  character: "角色回响",
  scene: "场景回响",
  divine: "神明献礼",
};

const KIND_LABEL: Record<WorldItemKind, string> = {
  instant: "即时",
  consumable: "消耗",
  passive: "永驻",
};

export default function ItemsGallery({ collectedIds }: ItemsGalleryProps) {
  const collectedSet = useMemo(() => new Set(collectedIds), [collectedIds]);

  const grouped = useMemo(() => {
    const map: Record<ResonanceSourceType, WorldItem[]> = {
      angel: [],
      character: [],
      scene: [],
      divine: [],
    };
    for (const item of EDEN_ITEMS) {
      map[item.sourceType].push(item);
    }
    return map;
  }, []);

  const collectedCount = useMemo(
    () => EDEN_ITEMS.filter((i) => collectedSet.has(i.id)).length,
    [collectedSet],
  );

  return (
    <div className="eden-codex-gallery eden-codex-gallery--items">
      <div className="eden-achievement-progress">
        已获得 <strong>{collectedCount}</strong> / {EDEN_ITEMS.length} 种回响
      </div>

      {SOURCE_ORDER.map((src) => {
        const list = grouped[src];
        if (list.length === 0) return null;
        const got = list.filter((i) => collectedSet.has(i.id)).length;
        return (
          <section key={src} className="eden-codex-section">
            <h3 className="eden-codex-section-title">
              {SOURCE_LABEL[src]}
              <span className="eden-codex-section-count">{got}/{list.length}</span>
            </h3>
            <div className="eden-codex-grid">
              {list.map((item) => {
                const collected = collectedSet.has(item.id);
                return (
                  <div
                    key={item.id}
                    className={`eden-codex-card ${collected ? "eden-codex-card--unlocked" : "eden-codex-card--locked"}`}
                    aria-label={`${collected ? "已获得" : "未获得"}回响：${collected ? item.title : "未知回响"}`}
                  >
                    <div className="eden-codex-card-icon">
                      <span aria-hidden="true">{item.icon ?? "✦"}</span>
                      {!collected && <span className="eden-achievement-card-lock" aria-hidden="true">锁</span>}
                    </div>
                    <p className="eden-codex-card-name">{collected ? item.title : "未曾获得"}</p>
                    <p className="eden-codex-card-desc">
                      {collected ? item.shortEffect : "尚未在园中遇见。"}
                    </p>
                    <p className="eden-codex-card-meta">
                      <span className={`eden-codex-kind eden-codex-kind--${item.kind}`}>{KIND_LABEL[item.kind]}</span>
                      <span className="eden-codex-source">{item.sourceName}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
