// ============================================================
// 第一章：神注视可视化组件
//
// 非侵入式 UI 增强：将 page.tsx 中圆点符号的神注视显示
// 替换为水滴 SVG 指示器 + 顶部叙事提示条 + 献礼闪光。
// 不改变任何神注视计算逻辑（divineAttentionRules）。
// ============================================================

type DivineAttentionVizProps = {
  /** 神的注视等级 0-4 */
  level: number;
  /** 当前叙事提示文案（顶部居中显示） */
  narration: string;
  /** 满 4 级触发神明献礼时，显示特殊闪光与文案 */
  giftFlash?: boolean;
  /** T6：神的注视累计点（正向累计资源，驱动三选一） */
  cumulative?: number;
  /** T6：下一次三选一阈值（已选 ownedCount 份后） */
  nextThreshold?: number | null;
  /** T6：已选神明献礼数 */
  ownedCount?: number;
};

// ---- 单个水滴 SVG ----
function Droplet({ active, index }: { active: boolean; index: number }) {
  return (
    <svg
      key={index}
      className={`eden-attention-droplet ${active ? "eden-attention-droplet--on" : "eden-attention-droplet--off"}`}
      width="18"
      height="24"
      viewBox="0 0 18 24"
      aria-hidden="true"
    >
      <path
        d="M9 1 C9 1 2 11 2 15 a7 7 0 0 0 14 15 C14 11 9 1 9 1 Z"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

export default function DivineAttentionViz({
  level,
  narration,
  giftFlash,
  cumulative,
  nextThreshold,
  ownedCount,
}: DivineAttentionVizProps) {
  const safeLevel = Math.max(0, Math.min(4, level));
  const showProgress = typeof cumulative === "number" && nextThreshold != null;
  const capstone = typeof ownedCount === "number" && ownedCount >= 7;

  return (
    <>
      {/* 注视指示器：4 个水滴 */}
      <span
        className={`eden-attention-stage eden-attention-stage--viz eden-attention-stage--l${safeLevel}`}
        title={`神的注视等级：${safeLevel} / 4`}
        aria-label={`神的注视等级 ${safeLevel} 级`}
      >
        {Array.from({ length: 4 }, (_, i) => (
          <Droplet key={i} active={i < safeLevel} index={i} />
        ))}
      </span>

      {/* 顶部居中叙事提示条 */}
      {narration && (
        <div className="eden-divine-narration-bar" role="status">
          {narration}
        </div>
      )}

      {/* T6：累计注视进度（驱动三选一） */}
      {showProgress && !capstone && (
        <div
          className="eden-attention-progress"
          title={`当前已累计${cumulative}点，再获得${nextThreshold - cumulative}点可领取神明献礼`}
        >
          <div className="eden-attention-progress-bar">
            <div
              className="eden-attention-progress-fill"
              style={{
                width: `${Math.min(100, Math.round(((cumulative ?? 0) / (nextThreshold ?? 1)) * 100))}%`,
              }}
            />
          </div>
          <span className="eden-attention-progress-text">
            注视值：{cumulative}/{nextThreshold}
          </span>
        </div>
      )}

      {/* T6：集满七献礼顶点提示 */}
      {capstone && (
        <div className="eden-attention-progress eden-attention-progress--capstone" role="status">
          <span className="eden-attention-progress-text">七恩俱临 · 园中众人对你全然倾心</span>
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
