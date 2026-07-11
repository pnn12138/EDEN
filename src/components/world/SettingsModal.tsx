"use client";

// ============================================================
// 第一章：设置浮窗
//
// 顶部最右侧「设置」图标点击后弹出，集中承载：
// - 账号态（用户名 / 游客 / 未登录 + 登录或退出入口）
// - 存档控制（保存 / 读取 / 重新开始）+ 存档状态
// 复用 useWorldSave 的 save/load/reset 与 SaveControl 的二次确认逻辑。
// 不改动任何规则层 / 游戏逻辑。
// ============================================================

import type { AuthState } from "@/lib/auth";

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
  auth: AuthState | null;
  onLoginClick: () => void;
  onLogout: () => void;
  onSave: () => void;
  onLoad: () => void;
  onReset: () => void;
  lastSavedAt: string | null;
  dirty: boolean;
};

export default function SettingsModal({
  open,
  onClose,
  auth,
  onLoginClick,
  onLogout,
  onSave,
  onLoad,
  onReset,
  lastSavedAt,
  dirty,
}: SettingsModalProps) {
  if (!open) return null;

  const saved = lastSavedAt != null && !dirty;

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

  const accountLabel =
    auth?.mode === "user" && auth.username
      ? `您好，${auth.username}`
      : auth?.mode === "guest"
        ? "游客模式"
        : "未登录";

  return (
    <div className="eden-modal-overlay" onClick={onClose}>
      <div
        className="eden-modal eden-modal--compact"
        role="dialog"
        aria-modal="true"
        aria-label="设置"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="eden-modal-header">
          <span className="eden-modal-title">设置</span>
          <button className="eden-modal-close" type="button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        <div className="eden-modal-body eden-settings-body">
          {/* 账号区 */}
          <section className="eden-settings-section">
            <span className="eden-settings-section-title">账号</span>
            <div className="eden-settings-account">
              <span className="eden-settings-account-label" data-testid="settings-account">
                {accountLabel}
              </span>
              {auth?.mode === "user" && (
                <button
                  className="eden-btn eden-btn--ghost eden-settings-account-btn"
                  type="button"
                  onClick={onLogout}
                  data-testid="settings-logout"
                >
                  退出登录
                </button>
              )}
              {auth === null && (
                <button
                  className="eden-btn eden-btn--ghost eden-settings-account-btn"
                  type="button"
                  onClick={onLoginClick}
                  data-testid="settings-login"
                >
                  登录
                </button>
              )}
            </div>
          </section>

          {/* 存档控制 */}
          <section className="eden-settings-section">
            <span className="eden-settings-section-title">存档</span>
            <div className="eden-settings-save-row">
              <button
                className="eden-btn eden-btn--primary"
                type="button"
                onClick={onSave}
                data-testid="world-save"
              >
                保存
              </button>
              <button
                className="eden-btn eden-btn--ghost"
                type="button"
                onClick={handleLoad}
                data-testid="world-load"
              >
                读取
              </button>
              <button
                className="eden-btn eden-btn--ghost"
                type="button"
                onClick={handleReset}
                data-testid="world-restart"
              >
                重新开始
              </button>
            </div>
            <div className="eden-settings-save-status" data-testid="world-save-dot">
              {saved ? `已保存${lastSavedAt ? " " + lastSavedAt : ""}` : "尚未保存"}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
