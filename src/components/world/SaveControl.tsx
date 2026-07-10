// ============================================================
// 第一章：存档控制组件
//
// 非侵入式 UI：顶部工具栏的「保存 / 读取 / 重新开始」按钮
// 与最后存档时间显示。
// 具体读写由上层 useWorldSave hook 负责，保持键名与格式不变。
// ============================================================

type SaveControlProps = {
  /** 最后存档时间文本，如 "14:32"，无则 null */
  lastSavedAt: string | null;
  /** 是否存在未保存的变动 */
  dirty: boolean;
  onSave: () => void;
  onLoad: () => void;
  onReset: () => void;
};

export default function SaveControl({
  lastSavedAt,
  dirty,
  onSave,
  onLoad,
  onReset,
}: SaveControlProps) {
  const handleLoad = () => {
    if (window.confirm("确定要读取上次存档吗？当前进度会丢失")) {
      onLoad();
    }
  };

  const handleReset = () => {
    if (window.confirm("确定要重新开始吗？所有进度会丢失")) {
      onReset();
    }
  };

  return (
    <div className="eden-save-control">
      <button
        className={`eden-btn eden-top-action-btn eden-btn--save ${dirty ? "eden-btn--save-dirty" : ""}`}
        onClick={onSave}
        title="将当前进度保存到本地"
        data-testid="world-save"
      >
        <span className="eden-top-action-label">保存</span>
      </button>
      <button
        className="eden-btn eden-top-action-btn"
        onClick={handleLoad}
        title="读取上次存档"
        data-testid="world-load"
      >
        <span className="eden-top-action-label">读取</span>
      </button>
      <button
        className="eden-btn eden-top-action-btn"
        onClick={handleReset}
        title="重新开始游戏"
        data-testid="world-restart"
      >
        <span className="eden-top-action-label">重新开始</span>
      </button>
      <span className="eden-save-time" data-testid="world-save-time">
        {lastSavedAt ? `已保存 ${lastSavedAt}` : "尚未保存"}
      </span>
    </div>
  );
}
