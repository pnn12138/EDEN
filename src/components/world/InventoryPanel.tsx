// ============================================================
// 第一章：园中回响背包（优化版）
//
// 非侵入式 UI 重构：从右侧浮窗调整为居中磨砂弹窗，
// 新增分类展示、悬浮提示、使用反馈、空状态与遮罩关闭。
//
// 道具使用 / 消耗逻辑完全复用上层传入的 onUseItem 回调，
// 不修改任何规则层代码（itemRules / toolRules）。
// ============================================================

import { useEffect, useState } from "react";
import type { WorldItemKind } from "@/content/world/items";
import { getItemById } from "@/content/world/items";

// ---- 分类叙事化命名 ----
const KIND_GROUPS: { kind: WorldItemKind; title: string }[] = [
  { kind: "consumable", title: "随身之叶" },
  { kind: "instant", title: "即时之露" },
  { kind: "passive", title: "永驻之印" },
];

// ---- 使用生效叙事化文案（按道具 ID，不显示数值/公式） ----
const ITEM_USE_FEEDBACK: Record<string, string> = {
  resonance_herald_feather: "你握紧白羽，下一次低语变得温和而坚定。",
  resonance_river_dew: "河水清露在你掌心化开，一点气力回来了。",
  resonance_morning_flame: "晨焰碎屑在指尖发暖，你更想问个明白。",
  resonance_boundary_mark: "边界之痕在你掌心轻颤，你记得分寸。",
  resonance_east_gate_glow: "东门辉光落在肩上，这一程走得分外轻。",
  consumable_first_whisper_free: "首语印记亮了一瞬，这一轮的第一句话不必费力。",
  consumable_trust_dew: "你把信任之露含在嘴里，声音变得更软了。",
  consumable_gentle_voice: "柔声印记贴上草叶，你学着把话放轻。",
  resonance_borrowed_name: "借来的名字在舌尖转了一圈，你将它递了出去。",
  resonance_hedgehog_bristle: "刺草信任在你手里发暖，你提醒自己放轻声音。",
  resonance_deer_glance: "鹿目余光掠过，你更想用提问而非命令。",
  resonance_fox_tail_note: "狐尾评语扫过尘土，你绕开了直白的催促。",
  resonance_still_leaf: "静息之叶贴着掌心，下一次低语不自觉地变轻。",
  resonance_silent_grass: "无声草在脚下铺开，这一回走动没有声响。",
  resonance_white_feather_echo: "白羽回声随河面泛起，鸽子今夜会带一句温和的话。",
  resonance_four_river_echo: "四河回声荡开，结局复盘里多出一句被你说过的话。",
  resonance_living_names: "万物名录在眼中展开，你开始看见每个生命的性情。",
  resonance_adam_quiet_bond: "静契之石贴着胸口，你与她之间有过安静的约定。",
  resonance_eve_own_voice: "她第一次主动向你说起真正的疑问，那声音只属于她。",
  gift_sabbath_dew: "息日露滴落下，一点行动的余地回来了。",
  gift_all_seduction_up: "低语之诱在喉间化开，你的话更柔软动人。",
  gift_attention_accel: "注视加速落下，你的试探更被神看见。",
  gift_resonance_double: "回响倍涌泛起，拾得的回响更浓了。",
  gift_threshold_cut: "界限松弛在心中漫开，你更愿顺着自己的判断。",
  gift_free_move: "无羁之步落在足下，穿行园中不再费力。",
  gift_whisper_anywhere: "随处低语在耳边响起，距离不再隔断你的声音。",
  gift_awaken_desire: "渴望苏醒在心里点亮，你想弄清善恶的念头更清晰。",
  passive_light_step: "轻步印记留在足下，这一时段的头一步分外轻盈。",
  passive_soft_whisper: "细语印记贴着喉咙，惊动神的那一句被悄悄压低。",
  moonlight_path_marker: "月光道标在掌心发亮，每时段可借它无视绕行 1~2 次。",
  resonance_life_fruit_taste: "生命之味在身体里化开，行动点上限永久 +1。",
  resonance_discernment_fruit: "分辨之果让善恶显形，你能看见每个已见角色的性情。",
  resonance_angel_feather: "天使残羽透露神与天使都尝过此树，女人与亚当对神的敬仰各 -10。",
  resonance_bond_insight: "相处之鉴映出每个人愿意被靠近的方式。",
};

function buildUseFeedback(itemId: string, title: string): string {
  return (
    ITEM_USE_FEEDBACK[itemId] ??
    `你取用了「${title}」，园中起了细微的回应。`
  );
}

type InventoryPanelProps = {
  inventory: string[];
  itemCounts: Record<string, number>;
  isLoading: boolean;
  onUseItem: (itemId: string) => void;
  onClose: () => void;
};

export default function InventoryPanel({
  inventory,
  itemCounts,
  isLoading,
  onUseItem,
  onClose,
}: InventoryPanelProps) {
  const [useFeedback, setUseFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!useFeedback) return;
    const id = setTimeout(() => setUseFeedback(null), 3000);
    return () => clearTimeout(id);
  }, [useFeedback]);

  const owned = inventory.filter((id) => (itemCounts[id] ?? 0) > 0);

  const handleUse = (itemId: string, title: string) => {
    onUseItem(itemId);
    setUseFeedback(buildUseFeedback(itemId, title));
  };

  const handleOverlayClick = () => onClose();

  return (
    <div
      className="eden-modal-overlay eden-resonance-overlay"
      onClick={handleOverlayClick}
    >
      <aside
        className="eden-resonance-panel eden-resonance-modal"
        data-testid="inventory-panel"
        role="dialog"
        aria-label="园中回响背包"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="eden-resonance-panel-header">
          <span className="eden-resonance-panel-title">园中回响</span>
          <button
            className="eden-panel-close-btn eden-resonance-close-text"
            type="button"
            onClick={onClose}
            aria-label="关闭回响面板"
          >
            关闭
          </button>
        </div>

        <div className="eden-resonance-panel-content">
          {owned.length === 0 ? (
            <p className="eden-empty-hint">暂无回响道具，探索伊甸园获得</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {KIND_GROUPS.map(({ kind, title }) => {
                const items = owned
                  .map((id) => getItemById(id))
                  .filter((it): it is NonNullable<typeof it> => !!it && it.kind === kind);
                if (items.length === 0) return null;
                return (
                  <div key={kind} className="eden-resonance-group">
                    <p className="eden-resonance-group-title">{title}</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {items.map((item) => {
                        const count = itemCounts[item.id] ?? 0;
                        const usable = item.kind !== "passive" && count > 0;
                        return (
                          <div
                            key={item.id}
                            className="eden-resonance-card"
                            title={item.shortEffect}
                          >
                            <div className="eden-resonance-card-header">
                              <span className="eden-resonance-card-name">
                                {item.icon && (
                                  <span className="eden-resonance-card-icon">
                                    {item.icon}
                                  </span>
                                )}
                                {item.kind === "passive" && (
                                  <span className="eden-resonance-card-prepared-mark">
                                    自动
                                  </span>
                                )}
                                {item.title}
                              </span>
                              {count > 1 && (
                                <span className="eden-resonance-card-count">×{count}</span>
                              )}
                            </div>
                            <p className="eden-resonance-card-desc">{item.shortEffect}</p>
                            <p className="eden-resonance-card-source">
                              来源：
                              {item.sourceType === "angel"
                                ? "天使"
                                : item.sourceType === "character"
                                  ? "角色"
                                  : item.sourceType === "scene"
                                    ? "场景"
                                    : "神明"}
                              （{item.sourceName}）
                            </p>
                            <div className="eden-resonance-card-actions">
                              {usable ? (
                                <button
                                  className="eden-btn eden-btn--resonance-action eden-btn--resonance-use"
                                  onClick={() => handleUse(item.id, item.title)}
                                  disabled={isLoading}
                                  title={item.shortEffect}
                                >
                                  使用
                                </button>
                              ) : (
                                item.kind === "passive" && (
                                  <span className="eden-resonance-passive-label">
                                    自动生效
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {useFeedback && (
          <div className="eden-resonance-use-feedback">{useFeedback}</div>
        )}
      </aside>
    </div>
  );
}
