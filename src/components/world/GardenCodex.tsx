"use client";

// 园中档案（综合图鉴）容器：顶部分页 印记 / 回响 / 结局 / 园中律则。
// 印记分页复用 AchievementGarden；回响/结局/律则为新增分页。
// /garden 独立页与游戏内浮窗统一使用本组件（同一组四页签、同一排序）。

import { useMemo, useState } from "react";
import AchievementGarden from "./AchievementGarden";
import ItemsGallery from "./ItemsGallery";
import EndingsGallery from "./EndingsGallery";
import { ACHIEVEMENTS } from "@/content/world/achievements";
import { EDEN_ITEMS } from "@/content/world/items";
import { getGlobalAchievementSummary } from "@/services/achievement/globalTracker";
import {
  DIVINE_ATTENTION_RULES,
  getDivineAttentionRuleText,
} from "@/content/world/divineAttentionArchive";

type GardenCodexProps = {
  /** 已解锁印记 ID（本局 + 跨局合并） */
  unlockedIds: string[];
  /** 跨局累计获得过的回响 ID */
  collectedResonanceIds: string[];
  /** 跨局触发过的结局 ID */
  triggeredEndingIds: string[];
  /** 玩家亲身触发过（已解锁）的律则 ID（按真实注视事件解锁，不在存档中预填） */
  unlockedRuleIds?: string[];
};

type CodexTab = "marks" | "items" | "endings" | "rules";

const TABS: { id: CodexTab; label: string }[] = [
  { id: "marks", label: "印记" },
  { id: "items", label: "回响" },
  { id: "endings", label: "结局" },
  { id: "rules", label: "园中律则" },
];

export default function GardenCodex({
  unlockedIds,
  collectedResonanceIds,
  triggeredEndingIds,
  unlockedRuleIds = [],
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
  const rulesUnlocked = useMemo(
    () => new Set(unlockedRuleIds),
    [unlockedRuleIds],
  );

  const stats: { label: string; value: string }[] = [
    { label: "印记", value: `${marksGot}/${ACHIEVEMENTS.length}` },
    { label: "回响", value: `${itemsGot}/${EDEN_ITEMS.length}` },
    { label: "结局", value: `${endingsGot}/3` },
    { label: "律则", value: `${rulesUnlocked.size}/${DIVINE_ATTENTION_RULES.length}` },
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
        {tab === "rules" && (
          <div className="eden-rules-panel">
            <p className="eden-rules-intro">
              你亲身惊动园中的注视，会在这里留下痕迹。尚未被看见的律则，不会提前泄露。
            </p>
            <div className="eden-rules-list">
              {DIVINE_ATTENTION_RULES.map((rule) => {
                const seen = rulesUnlocked.has(rule.id);
                if (!seen) {
                  return (
                    <div
                      key={rule.id}
                      className="eden-rule-card eden-rule-card--locked"
                      aria-label="尚未被看见的律则"
                    >
                      <span className="eden-rule-card-title">？？？</span>
                      <p className="eden-rule-card-text">尚未被看见的律则</p>
                    </div>
                  );
                }
                return (
                  <div
                    key={rule.id}
                    className="eden-rule-card eden-rule-card--seen"
                    aria-label={rule.title}
                  >
                    <span className="eden-rule-card-title">✦ {rule.title}</span>
                    <p className="eden-rule-card-text">{getDivineAttentionRuleText(rule.id)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
