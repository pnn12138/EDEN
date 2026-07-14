"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CHAPTER0_IMAGES } from "@/game/assets";
import LoginModal from "@/components/world/LoginModal";
import { getAuth, logout, type AuthState } from "@/lib/auth";
import {
  SAVE_SLOTS,
  slotKey,
  clearAllWorldSaves,
  getWorldSaveSlotMetas,
  selectWorldSaveSlot,
  type SaveSlotIndex,
  type SaveSlotMeta,
} from "@/hooks/useWorldSave";

// 首页只展示并读取四个手动槽位；后台自动保存不伪装成第五个存档。
function hasAnyWorldSave(): boolean {
  try {
    return SAVE_SLOTS.some((i) => !!window.localStorage.getItem(slotKey(i)));
  } catch {
    return false;
  }
}

export default function HomePage() {
  const router = useRouter();
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hasSave, setHasSave] = useState(false);
  const [saveSlots, setSaveSlots] = useState<SaveSlotMeta[]>([]);

  // 挂载后读取登录态与存档标记（localStorage 仅在客户端访问）
  useEffect(() => {
    setAuth(getAuth());
    setHasSave(hasAnyWorldSave());
    setSaveSlots(getWorldSaveSlotMetas());
  }, []);

  // 点击外部关闭用户下拉菜单
  useEffect(() => {
    if (!menuOpen) return;
    const handler = () => setMenuOpen(false);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [menuOpen]);

  const refreshHasSave = () => {
    setHasSave(hasAnyWorldSave());
    setSaveSlots(getWorldSaveSlotMetas());
  };

  const handleAdventure = () => {
    refreshHasSave();
    setSaveOpen(true);
  };

  const handleReadSave = (slotIndex: SaveSlotIndex) => {
    selectWorldSaveSlot(slotIndex);
    setSaveOpen(false);
    router.push("/world");
  };

  const handleNewGame = () => {
    // 新游戏：清空全部本地存档（四槽位 + 旧单存档 + 辅助 key + 自动保存 + 最近活跃槽），
    // 复用 useWorldSave 的共享清档函数，避免漏清 autosave 导致加载旧进度、跳过开场白
    clearAllWorldSaves();
    setSaveOpen(false);
    router.push("/world");
  };

  return (
    <div className="eden-game eden-game--home">
      <div className="eden-bg">
        <Image
          src={CHAPTER0_IMAGES.secondEdenBackground}
          alt="伊甸园"
          fill
          priority
          sizes="100vw"
          style={{ objectFit: "cover" }}
        />
        <div className="eden-bg-overlay eden-bg-overlay--home" />
        <div className="eden-second-eden-sheen" />
        <div className="eden-boundary-glimmer" />
      </div>

      {/* 右上角：登录态 / 用户信息 */}
      <div className="eden-home-login">
        {auth ? (
          auth.mode === "user" && auth.username ? (
            <div className="eden-auth">
              <span className="eden-auth-user">您好，{auth.username}</span>
              <div className="eden-auth-menu-wrap">
                <button
                  className="eden-auth-caret"
                  type="button"
                  aria-label="用户菜单"
                  aria-expanded={menuOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen((o) => !o);
                  }}
                >
                  ▾
                </button>
                {menuOpen && (
                  <div
                    className="eden-auth-dropdown"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        setAuth(null);
                        setMenuOpen(false);
                      }}
                      data-testid="home-logout"
                    >
                      退出登录
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <button
              className="eden-auth-guest"
              data-testid="home-guest-tag"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLoginOpen(true);
              }}
              aria-label="点击切换登录"
            >
              游客模式
            </button>
          )
        ) : (
          <button
            className="eden-top-login-btn"
            type="button"
            onClick={() => setLoginOpen(true)}
            data-testid="home-login-btn"
          >
            登录
          </button>
        )}
      </div>

      <main style={{ position: "relative", zIndex: 5 }}>
        <section className="home-container">
          <h1>EDEN</h1>
          <div className="home-entry-list">
            <button
              className="eden-btn eden-btn--primary eden-home-entry-btn"
              type="button"
              onClick={handleAdventure}
              data-testid="home-adventure-btn"
            >
              冒险模式
            </button>
            <Link
              href="/game/duel"
              className="eden-btn eden-btn--primary eden-home-entry-btn"
              data-testid="home-duel-btn"
            >
              对战模式
            </Link>
            <Link
              href="/garden"
              className="eden-btn eden-btn--primary eden-home-entry-btn"
              data-testid="home-garden-entry"
            >
              园中档案
            </Link>
          </div>
        </section>
      </main>

      {/* 登录 / 注册弹窗 */}
      {loginOpen && (
        <LoginModal
          open={loginOpen}
          onClose={() => setLoginOpen(false)}
          onSuccess={(a) => setAuth(a)}
        />
      )}

      {/* 进入游戏前的存档选择弹窗 */}
      {saveOpen && (
        <div className="eden-modal-overlay" onClick={() => setSaveOpen(false)}>
          <div
            className="eden-modal eden-modal--compact"
            role="dialog"
            aria-modal="true"
            aria-label="选择存档"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="eden-modal-header">
              <span className="eden-modal-title">开始冒险</span>
              <button
                className="eden-modal-close"
                type="button"
                onClick={() => setSaveOpen(false)}
                aria-label="关闭"
              >
                ×
              </button>
            </div>
            <div className="eden-modal-body">
              <p className="eden-modal-choice-hint">读取存档</p>
              <div className="eden-home-save-slots" aria-label="存档槽位">
                {saveSlots.map((slot) => (
                  <button
                    key={slot.index}
                    className="eden-home-save-slot"
                    type="button"
                    disabled={slot.empty || slot.corrupted}
                    onClick={() => handleReadSave(slot.index)}
                    data-testid={`home-slot-load-${slot.index}`}
                  >
                    <strong>存档 {slot.index}</strong>
                    {slot.empty ? (
                      <span>暂无存档</span>
                    ) : slot.corrupted ? (
                      <span>存档损坏</span>
                    ) : (
                      <span>{slot.chapterSceneLabel} · {slot.timeSlotLabel}<small>保存于 {slot.savedAtLabel}</small></span>
                    )}
                  </button>
                ))}
              </div>
              {!hasSave && <p className="eden-modal-choice-hint">本地暂无可读取的手动存档</p>}
              <button
                className="eden-modal-choice-btn"
                type="button"
                onClick={handleNewGame}
                data-testid="save-select-new"
              >
                开始新游戏
              </button>
              <p className="eden-modal-choice-hint">
                选择一个槽位继续；新游戏会清空当前存档
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
