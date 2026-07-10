"use client";

// 登录面板（Phase 2 Task 2.4）
//
// 纯前端实现：仅用 localStorage 记录用户名（key: eden:user:username）。
// 不接入任何云服务、不存储密码、不硬编码密钥——满足比赛「不暴露密钥 /
// 浏览器端可独立运行」约束。没有用户名也能正常游玩（游客模式）。
//
// 用户名规则：长度 2-10，仅允许中文 / 字母 / 数字 / 下划线，不含特殊符号。

import { useCallback, useEffect, useState } from "react";

const USER_KEY = "eden:user:username";
const USER_RE = /^[一-龥a-zA-Z0-9_]+$/;
const MIN_LEN = 2;
const MAX_LEN = 10;

export default function LoginPanel() {
  const [storedUser, setStoredUser] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const u = window.localStorage.getItem(USER_KEY);
      setStoredUser(u && USER_RE.test(u) ? u : null);
    } catch {
      setStoredUser(null);
    }
  }, []);

  const handleEnter = useCallback(() => {
    const name = draft.trim();
    if (name.length < MIN_LEN || name.length > MAX_LEN) {
      setError(`用户名需为 ${MIN_LEN}-${MAX_LEN} 个字符`);
      return;
    }
    if (!USER_RE.test(name)) {
      setError("用户名只能包含中文、字母、数字或下划线");
      return;
    }
    try {
      window.localStorage.setItem(USER_KEY, name);
    } catch {
      /* 忽略写入失败（隐私模式等） */
    }
    setStoredUser(name);
    setDraft("");
    setError(null);
  }, [draft]);

  const handleLogout = useCallback(() => {
    try {
      window.localStorage.removeItem(USER_KEY);
    } catch {
      /* noop */
    }
    setStoredUser(null);
    setDraft("");
    setError(null);
  }, []);

  if (storedUser) {
    return (
      <div className="eden-login eden-login--in" data-testid="login-region">
        <span className="eden-login-user" data-testid="login-user">
          {storedUser}
        </span>
        <button
          type="button"
          className="eden-login-btn eden-login-btn--logout"
          onClick={handleLogout}
          data-testid="login-logout"
        >
          退出
        </button>
      </div>
    );
  }

  return (
    <div className="eden-login eden-login--out" data-testid="login-region">
      <input
        type="text"
        className="eden-login-input"
        value={draft}
        maxLength={MAX_LEN + 4}
        placeholder="取名（2-10 字）"
        aria-label="用户名"
        data-testid="login-input"
        onChange={(e) => {
          setDraft(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleEnter();
        }}
      />
      <button
        type="button"
        className="eden-login-btn eden-login-btn--enter"
        onClick={handleEnter}
        data-testid="login-enter"
      >
        进入
      </button>
      {error && (
        <span className="eden-login-error" data-testid="login-error">
          {error}
        </span>
      )}
    </div>
  );
}
