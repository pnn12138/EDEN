// ============================================================
// 第一章：神注视可视化组件（Task 2R 重构版）
//
// 仅显示：注视等级 N/7 + 当前进度 value/threshold。
// 不再渲染四滴水 SVG；旧 0-4 水滴 UI 已被玩家替换。
// 不改变任何神注视计算逻辑（divineAttentionRules）。
// ============================================================

type DivineAttentionVizProps = {
  /** 神的注视等级 0-7（已选献礼数，非旧 0-4 压力值） */
  level: number;
  /** 当前叙事提示文案（顶部居中显示） */
  narration: string;
  /** 满 7 阶触发顶点时显示特殊文案 */
  giftFlash?: boolean;
  /** 当前阶注视值（divineAttentionValue） */
  currentValue?: number;
  /** 当前阶门槛阈值（null 表示已达第七阶或开局） */
  nextThreshold?: number | null;
  /** 已选神明献礼数 */
  ownedCount?: number;
};

export default function DivineAttentionViz({
  level,
  narration,
  giftFlash,
  currentValue,
  nextThreshold,
  ownedCount,
}: DivineAttentionVizProps) {
  const safeOwned = Math.max(0, Math.min(7, ownedCount ?? 0));
  const showProgress = typeof currentValue === "number" && nextThreshold != null && nextThreshold > 0;
  const capstone = typeof ownedCount === "number" && ownedCount >= 7;

  return (
    <>
      <div className="eden-attention-cluster">
        {/* 注视等级标签 */}
        <span
          className="eden-attention-stage eden-attention-stage--viz"
          title={`神的注视等级：${safeOwned} / 7`}
          aria-label={`神的注视等级 ${safeOwned} / 7`}
        >
          神明注视 · 等级 {safeOwned}/7
        </span>

        {/* 当前进度：顶部只保留数值，避免重复占用“注视”文案 */}
        {showProgress && !capstone && (
          <div
            className="eden-attention-progress"
            title={`当前注视进度 ${currentValue}/${nextThreshold}`}
          >
            <div className="eden-attention-progress-bar">
              <div
                className="eden-attention-progress-fill"
                style={{
                  width: `${Math.min(100, Math.round(((currentValue ?? 0) / (nextThreshold ?? 1)) * 100))}%`,
                }}
              />
            </div>
            <span className="eden-attention-progress-text">
              {currentValue}/{nextThreshold}
            </span>
          </div>
        )}

        {/* 集满七献礼顶点 */}
        {capstone && (
          <div className="eden-attention-progress eden-attention-progress--capstone" role="status">
            <span className="eden-attention-progress-text">七恩俱临 · 园中众人对你全然倾心</span>
          </div>
        )}
      </div>

      {/* 顶部居中叙事提示条 */}
      {narration && (
        <div className="eden-divine-narration-bar" role="status">
          {narration}
        </div>
      )}

      {/* 满级献礼闪光 */}
      {giftFlash && (
        <div className="eden-divine-gift-flash" aria-live="polite">
          <span className="eden-divine-gift-flash-text">
            风完全停了，你脚边多了一个发光的印记
          </span>
        </div>
      )}
    </>
  );
}
