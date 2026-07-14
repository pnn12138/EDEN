"use client";

import { useEffect, useState } from "react";

// ============================================================
// 第一章：设置浮窗（Task 6 重构为页签式）
//
// 页签：存档匣 | AI 创作 | 账号
// - 存档匣：四槽读/存/覆盖/删除为分开的显式动作；读取/返回主页/重开遇到 dirty 才模态内确认。
//   损坏槽保留、不静默清除。不更改四槽与 autosave 的存储 key。
// - AI 创作：仅存 sessionStorage（loadEndingMediaSettings / saveEndingMediaSettings），
//   不进入游戏存档。仅允许 HTTPS；空字段表示继承服务端默认。
// - 账号：现有账号态展示。
// 不使用 window.confirm；所有确认走模态内确认层，保留 Escape / 关闭按钮 / 键盘焦点。
// ============================================================

import type { AuthState } from "@/lib/auth";
import type { SaveSlotIndex, SaveSlotMeta } from "@/hooks/useWorldSave";
import {
  loadEndingMediaSettings,
  saveEndingMediaSettings,
  validateEndingMediaSettings,
  type EndingMediaSettings,
} from "@/lib/endingMediaSettings";

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
  auth: AuthState | null;
  onLoginClick: () => void;
  onLogout: () => void;
  onSave: (slotIndex: SaveSlotIndex) => void;
  onLoad: (slotIndex: SaveSlotIndex) => void;
  onDelete: (slotIndex: SaveSlotIndex) => void;
  onReset: () => void;
  onGoHome: () => void;
  /** 打开时默认选中的页签（如由结局页"打开设置"跳到 AI 创作）；缺省为存档匣 */
  initialTab?: TabId;
  slotMetas: SaveSlotMeta[];
  lastSavedAt: string | null;
  dirty: boolean;
};

export type TabId = "cabinet" | "ai" | "account";

type PendingConfirm =
  | null
  | { kind: "overwrite"; slot: SaveSlotMeta }
  | { kind: "load"; slot: SaveSlotMeta }
  | { kind: "delete"; slot: SaveSlotMeta }
  | { kind: "reset" }
  | { kind: "goHome" };

export default function SettingsModal({
  open,
  onClose,
  auth,
  onLoginClick,
  onLogout,
  onSave,
  onLoad,
  onDelete,
  onReset,
  onGoHome,
  initialTab,
  slotMetas,
  lastSavedAt,
  dirty,
}: SettingsModalProps) {
  const [tab, setTab] = useState<TabId>("cabinet");
  const [pickerMode, setPickerMode] = useState<"save" | "load" | null>(null);
  const [pending, setPending] = useState<PendingConfirm>(null);

  // AI 创作表单（仅 sessionStorage）
  const [media, setMedia] = useState<EndingMediaSettings>(() => loadEndingMediaSettings());
  const [mediaErrors, setMediaErrors] = useState<Record<string, string>>({});
  const [mediaSaved, setMediaSaved] = useState(false);

  // 关闭浮窗时重置选择/确认态
  useEffect(() => {
    if (!open) {
      setPickerMode(null);
      setPending(null);
    }
  }, [open]);

  // 打开时按 initialTab 切到对应页签（如结局页"打开设置"跳到 AI 创作）
  useEffect(() => {
    if (open) setTab(initialTab ?? "cabinet");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTab]);

  // 进入 AI 创作页签时刷新表单（会话内可能已被其它入口修改）
  useEffect(() => {
    if (open && tab === "ai") {
      setMedia(loadEndingMediaSettings());
      setMediaErrors({});
      setMediaSaved(false);
    }
  }, [open, tab]);

  // Escape 关闭（确认层优先关闭确认层）
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (pending) setPending(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onClose]);

  if (!open) return null;

  const saved = lastSavedAt != null && !dirty;

  const requestSave = (slot: SaveSlotMeta) => {
    if (!slot.empty && !slot.corrupted) {
      setPending({ kind: "overwrite", slot });
      return;
    }
    onSave(slot.index);
    setPickerMode(null);
  };

  const requestLoad = (slot: SaveSlotMeta) => {
    if (slot.empty || slot.corrupted) return;
    if (dirty) {
      setPending({ kind: "load", slot });
      return;
    }
    onLoad(slot.index);
    setPickerMode(null);
    onClose();
  };

  const requestDelete = (slot: SaveSlotMeta) => {
    setPending({ kind: "delete", slot });
  };

  const requestReset = () => setPending({ kind: "reset" });
  const requestGoHome = () => {
    if (dirty) {
      setPending({ kind: "goHome" });
      return;
    }
    onGoHome();
  };

  const confirmPending = () => {
    if (!pending) return;
    switch (pending.kind) {
      case "overwrite":
        onSave(pending.slot.index);
        break;
      case "load":
        onLoad(pending.slot.index);
        onClose();
        break;
      case "delete":
        onDelete(pending.slot.index);
        break;
      case "reset":
        onReset();
        onClose();
        break;
      case "goHome":
        onGoHome();
        break;
    }
    setPending(null);
    setPickerMode(null);
  };

  const saveMedia = () => {
    const result = saveEndingMediaSettings(media);
    if (!result.ok) {
      setMediaErrors(result.errors);
      setMediaSaved(false);
      return;
    }
    setMediaErrors({});
    setMediaSaved(true);
  };

  const accountLabel =
    auth?.mode === "user" && auth.username
      ? `您好，${auth.username}`
      : auth?.mode === "guest"
        ? "游客模式"
        : "未登录";

  const setMediaField = <K extends keyof EndingMediaSettings>(key: K, value: EndingMediaSettings[K]) => {
    setMedia((m) => ({ ...m, [key]: value }));
    setMediaSaved(false);
  };

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

        <div className="eden-settings-tabs" role="tablist" aria-label="设置页签">
          {(
            [
              ["cabinet", "存档匣"],
              ["ai", "AI 创作"],
              ["account", "账号"],
            ] as [TabId, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              className={`eden-settings-tab ${tab === id ? "eden-settings-tab--active" : ""}`}
              onClick={() => {
                setTab(id);
                setPickerMode(null);
                setPending(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="eden-modal-body eden-settings-body">
          {/* 存档匣 */}
          {tab === "cabinet" && (
            <section className="eden-settings-section">
              <span className="eden-settings-section-title">存档匣</span>
              <div className="eden-settings-save-row">
                <button className="eden-btn eden-btn--primary" type="button" onClick={() => setPickerMode("save")} data-testid="world-save">
                  保存
                </button>
                <button className="eden-btn eden-btn--ghost" type="button" onClick={() => setPickerMode("load")} data-testid="world-load">
                  读取
                </button>
                <button className="eden-btn eden-btn--ghost" type="button" onClick={requestReset} data-testid="world-restart">
                  重新开始
                </button>
                <button className="eden-btn eden-btn--ghost eden-btn--home" type="button" onClick={requestGoHome} data-testid="world-home">
                  返回主页
                </button>
              </div>
              <div className="eden-settings-save-status" data-testid="world-save-dot">
                {saved ? `已保存${lastSavedAt ? " " + lastSavedAt : ""}` : "尚未保存"}
              </div>

              {pickerMode && (
                <div className="eden-save-slots">
                  <div className="eden-save-slots-head">
                    <span>{pickerMode === "save" ? "选择要保存的槽位" : "选择要读取的槽位"}</span>
                    <button type="button" className="eden-save-slots-close" onClick={() => setPickerMode(null)} aria-label="关闭槽位选择">
                      ×
                    </button>
                  </div>
                  {slotMetas.map((m) => (
                    <div key={m.index} className={`eden-save-slot ${m.empty || m.corrupted ? "eden-save-slot--empty" : ""}`}>
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
                      <span className="eden-save-slot-actions">
                        {pickerMode === "save" ? (
                          <button type="button" className="eden-save-slot-btn" onClick={() => requestSave(m)} data-testid={`world-slot-save-${m.index}`}>
                            保存到此处
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="eden-save-slot-btn"
                            disabled={m.empty || m.corrupted}
                            onClick={() => requestLoad(m)}
                            data-testid={`world-slot-load-${m.index}`}
                          >
                            读取
                          </button>
                        )}
                        {!m.empty && (
                          <button type="button" className="eden-save-slot-btn eden-save-slot-btn--danger" onClick={() => requestDelete(m)} data-testid={`world-slot-delete-${m.index}`}>
                            删除
                          </button>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* AI 创作（仅 sessionStorage，不写入游戏存档） */}
          {tab === "ai" && (
            <section className="eden-settings-section">
              <span className="eden-settings-section-title">AI 创作</span>
              <p className="eden-settings-hint-text">
                这些配置仅保存在当前浏览器会话，刷新后不再留存，也不写入游戏存档。空字段表示继承服务端环境变量。仅允许 HTTPS 地址。
              </p>
              <div className="eden-ai-media-form">
                <fieldset className="eden-ai-media-group">
                  <legend>图像生成</legend>
                  <label>
                    图像 Provider
                    <input type="text" value={media.imageProvider} onChange={(e) => setMediaField("imageProvider", e.target.value)} placeholder="（空 = 服务端默认）" />
                  </label>
                  <label>
                    图像 Key
                    <input type="password" value={media.imageKey} onChange={(e) => setMediaField("imageKey", e.target.value)} placeholder="（空 = 服务端默认）" autoComplete="off" />
                  </label>
                  <label>
                    图像 Base URL
                    <input type="text" value={media.imageBaseUrl} onChange={(e) => setMediaField("imageBaseUrl", e.target.value)} placeholder="（可选）" />
                    {mediaErrors.imageBaseUrl && <span className="eden-ai-media-error">{mediaErrors.imageBaseUrl}</span>}
                  </label>
                  <label>
                    图像模型
                    <input type="text" value={media.imageModel} onChange={(e) => setMediaField("imageModel", e.target.value)} placeholder="（可选）" />
                  </label>
                  <label>
                    图像尺寸
                    <input type="text" value={media.imageSize} onChange={(e) => setMediaField("imageSize", e.target.value)} placeholder="（可选）空=服务端默认；Ark/Seedream 用 2K" />
                  </label>
                  <label>
                    图片数量上限
                    <input
                      type="number"
                      min={1}
                      max={6}
                      step={1}
                      value={media.imageCount}
                      onChange={(e) => setMediaField("imageCount", Math.max(1, Math.min(6, Number(e.target.value) || 1)))}
                    />
                    <span className="eden-ai-media-note">AI 会根据本局日志决定实际张数，最多不超过此值。</span>
                  </label>
                  <label>
                    结局创作希望
                    <textarea
                      value={media.imageHope}
                      onChange={(e) => setMediaField("imageHope", e.target.value)}
                      placeholder="例如：更突出河流、月光与蛇离开伊甸的孤独感"
                      rows={3}
                    />
                    <span className="eden-ai-media-note">AI 会结合本局日志判断哪些画面确实有足够素材。</span>
                  </label>
                </fieldset>
              </div>
              <div className="eden-ai-media-actions">
                <button type="button" className="eden-btn eden-btn--primary" onClick={saveMedia} data-testid="ai-media-save">
                  保存配置
                </button>
                {mediaSaved && <span className="eden-ai-media-saved" data-testid="ai-media-saved">已保存到本次会话</span>}
              </div>
            </section>
          )}

          {/* 账号 */}
          {tab === "account" && (
            <section className="eden-settings-section">
              <span className="eden-settings-section-title">账号</span>
              <div className="eden-settings-account">
                <span className="eden-settings-account-label" data-testid="settings-account">
                  {accountLabel}
                </span>
                {auth?.mode === "user" && (
                  <button className="eden-btn eden-btn--ghost eden-settings-account-btn" type="button" onClick={onLogout} data-testid="settings-logout">
                    退出登录
                  </button>
                )}
                {auth === null && (
                  <button className="eden-btn eden-btn--ghost eden-settings-account-btn" type="button" onClick={onLoginClick} data-testid="settings-login">
                    登录
                  </button>
                )}
              </div>
            </section>
          )}
        </div>

        {/* 模态内确认层（替代 window.confirm） */}
        {pending && (
          <div className="eden-modal-confirm-overlay" onClick={(e) => { e.stopPropagation(); setPending(null); }}>
            <div className="eden-modal-confirm" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <p className="eden-modal-confirm-text">
                {pending.kind === "overwrite" && `槽位 ${pending.slot.index} 已有存档（${pending.slot.savedAtLabel}），确定覆盖？`}
                {pending.kind === "load" && `读取存档将替换当前未保存的进度，确定继续？`}
                {pending.kind === "delete" && `确定删除槽位 ${pending.slot.index} 的存档？此操作不可撤销。`}
                {pending.kind === "reset" && `确定重新开始吗？所有进度会丢失。`}
                {pending.kind === "goHome" && `尚未保存的进度可能会丢失，确定返回主页吗？`}
              </p>
              <div className="eden-modal-confirm-actions">
                <button type="button" className="eden-btn eden-btn--primary" onClick={confirmPending} data-testid="settings-confirm-ok">
                  确认
                </button>
                <button type="button" className="eden-btn eden-btn--ghost" onClick={() => setPending(null)} data-testid="settings-confirm-cancel">
                  取消
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
