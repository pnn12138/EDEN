"use client";

import { useEffect, useState } from "react";

// ============================================================
// 第一章：设置浮窗
//
// 顶部最右侧「设置」图标点击后弹出，集中承载：
// - 账号态（用户名 / 游客 / 未登录 + 登录或退出入口）
// - 存档控制（四槽位保存 / 读取 / 重新开始）+ 返回主页 + 存档状态
// 复用 useWorldSave 的四槽位 save/load/reset 与二次确认逻辑。
// 不改动任何规则层 / 游戏逻辑。
// ============================================================

import type { AuthState } from "@/lib/auth";
import type { SaveSlotIndex, SaveSlotMeta } from "@/hooks/useWorldSave";

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
  auth: AuthState | null;
  onLoginClick: () => void;
  onLogout: () => void;
  onSave: (slotIndex: SaveSlotIndex) => void;
  onLoad: (slotIndex: SaveSlotIndex) => void;
  onReset: () => void;
  onGoHome: () => void;
  slotMetas: SaveSlotMeta[];
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
  onGoHome,
  slotMetas,
  lastSavedAt,
  dirty,
}: SettingsModalProps) {
  const [pickerMode, setPickerMode] = useState<"save" | "load" | null>(null);

  // 关闭浮窗时重置槽位选择模式，避免下次打开停留在上次模式
  useEffect(() => {
    if (!open) setPickerMode(null);
  }, [open]);

  if (!open) return null;

  const saved = lastSavedAt != null && !dirty;

  const handleSaveClick = () => {
    setPickerMode("save");
  };

  const handleLoadClick = () => {
    setPickerMode("load");
  };

  const handlePickSlot = (m: SaveSlotMeta) => {
    if (pickerMode === "save") {
      if (!m.empty) {
        if (!window.confirm(`该槽位已有存档（${m.savedAtLabel}），是否覆盖？`)) {
          return;
        }
      }
      onSave(m.index);
      setPickerMode(null);
    } else if (pickerMode === "load") {
      if (m.empty) return;
      if (!window.confirm("读取存档将替换当前未保存的游戏进度，是否继续？")) {
        return;
      }
      onLoad(m.index);
      setPickerMode(null);
      onClose();
    }
  };

  const handleReset = () => {
    if (window.confirm("确定要重新开始吗？所有进度会丢失")) {
      onReset();
      setPickerMode(null);
      onClose();
    }
  };

  const handleGoHome = () => {
    if (window.confirm("尚未保存的进度可能会丢失，确定返回主页吗？")) {
      onGoHome();
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
                onClick={handleSaveClick}
                data-testid="world-save"
              >
                保存
              </button>
              <button
                className="eden-btn eden-btn--ghost"
                type="button"
                onClick={handleLoadClick}
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
              <button
                className="eden-btn eden-btn--ghost eden-btn--home"
                type="button"
                onClick={handleGoHome}
                data-testid="world-home"
              >
                返回主页
              </button>
            </div>
            <div className="eden-settings-save-status" data-testid="world-save-dot">
              {saved ? `已保存${lastSavedAt ? " " + lastSavedAt : ""}` : "尚未保存"}
            </div>

            {pickerMode && (
              <div className="eden-save-slots">
                <div className="eden-save-slots-head">
                  <span>
                    {pickerMode === "save" ? "选择要保存的槽位" : "选择要读取的槽位"}
                  </span>
                  <button
                    type="button"
                    className="eden-save-slots-close"
                    onClick={() => setPickerMode(null)}
                    aria-label="关闭槽位选择"
                  >
                    ×
                  </button>
                </div>
                {slotMetas.map((m) => (
                  <button
                    key={m.index}
                    type="button"
                    className={`eden-save-slot ${m.empty || m.corrupted ? "eden-save-slot--empty" : ""}`}
                    disabled={pickerMode === "load" && (m.empty || m.corrupted)}
                    onClick={() => handlePickSlot(m)}
                    data-testid={`world-slot-${m.index}`}
                  >
                    <span className="eden-save-slot-title">存档 {m.index}</span>
                    {m.empty ? (
                      <span className="eden-save-slot-empty-hint">暂无存档</span>
                    ) : m.corrupted ? (
                      <span className="eden-save-slot-empty-hint">存档损坏</span>
                    ) : (
                      <>
                        <span className="eden-save-slot-scene">{m.chapterSceneLabel}</span>
                        <span className="eden-save-slot-timeslot">{m.timeSlotLabel}</span>
                        <span className="eden-save-slot-time">保存于 {m.savedAtLabel}</span>
                      </>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
