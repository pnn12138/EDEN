"use client";

// 园中档案（综合图鉴）容器：顶部分页 印记 / 回响 / 结局 + 跨局进度统计。
// 印记分页复用 AchievementGarden；回响/结局为新增分页。
// /garden 独立页使用本组件；世界页内浮窗仍直接用 AchievementGarden（仅印记）。

import { useMemo, useState } from "react";
import AchievementGarden from "./AchievementGarden";
import ItemsGallery from "./ItemsGallery";
import EndingsGallery from "./EndingsGallery";
import { ACHIEVEMENTS } from "@/content/world/achievements";
import { EDEN_ITEMS } from "@/content/world/items";
import { getGlobalAchievementSummary } from "@/services/achievement/globalTracker";

type GardenCodexProps = {
  /** 已解锁印记 ID（本局 + 跨局合并） */
  unlockedIds: string[];
  /** 跨局累计获得过的回响 ID */
  collectedResonanceIds: string[];
  /** 跨局触发过的结局 ID */
  triggeredEndingIds: string[];
};

type CodexTab = "marks" | "items" | "endings";

const TABS: { id: CodexTab; label: string }[] = [
  { id: "marks", label: "园中印记" },
  { id: "items", label: "园中回响" },
  { id: "endings", label: "诸般结局" },
];

export default function GardenCodex({
  unlockedIds,
  collectedResonanceIds,
  triggeredEndingIds,
}: GardenCodexProps) {
  const [tab, setTab] = useState<CodexTab>("marks");

  const summary = useMemo(() => getGlobalAchievementSummary(), []);
  const marksGot = useMemo(
    () => ACHIEVEMENTS.filter((a) => new Set(unlockedIds).has(a.id)).length,
    [unlockedIds],
  );
  const itemsGot = useMemo(
    () => EDEN_ITEMS.filter((i) => new Set(collectedResonanceIds).has(i.id)).length,
    [collectedResonanceIds],
  );
  const endingsGot = useMemo(
    () => new Set(triggeredEndingIds.filter((id) => ["eve_eats_fruit", "god_arrives", "life_fruit"].includes(id))).size,
    [triggeredEndingIds],
  );

  const stats: { label: string; value: string }[] = [
    { label: "印记", value: `${marksGot}/${ACHIEVEMENTS.length}` },
    { label: "回响", value: `${itemsGot}/${EDEN_ITEMS.length}` },
    { label: "结局", value: `${endingsGot}/3` },
    { label: "注视峰值", value: `${summary.maxDivineAttention}` },
  ];

  return (
    <div className="eden-codex">
      <div className="eden-codex-stats" aria-label="园中档案总览">
        {stats.map((s) => (
          <div key={s.label} className="eden-codex-stat">
            <span className="eden-codex-stat-label">{s.label}</span>
            <span className="eden-codex-stat-value">{s.value}</span>
          </div>
        ))}
      </div>

      <div className="eden-codex-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`garden-tab-${t.id}`}
            aria-controls={`garden-panel-${t.id}`}
            aria-selected={tab === t.id}
            className={`eden-codex-tab ${tab === t.id ? "eden-codex-tab--active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        id={`garden-panel-${tab}`}
        className="eden-codex-panel"
        role="tabpanel"
        aria-labelledby={`garden-tab-${tab}`}
      >
        {tab === "marks" && <AchievementGarden unlockedIds={unlockedIds} />}
        {tab === "items" && <ItemsGallery collectedIds={collectedResonanceIds} />}
        {tab === "endings" && <EndingsGallery triggeredIds={triggeredEndingIds} />}
      </div>
    </div>
  );
}
