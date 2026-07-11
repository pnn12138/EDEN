"use client";

// ============================================================
// 首页登录 / 注册弹窗（纯前端，无接口）
//
// - 中央磨砂弹窗：360×420，圆角 16px
// - 账号 2-10 位、密码 4-20 位，不符合时【进入冒险】置灰
// - 账号不存在自动注册；已存在校验密码
// - 登录成功写入 eden:token，并回调上层刷新右上角状态
// - 游客模式直接关闭弹窗，写入 eden:save:guest
// 不修改任何核心玩法 / 状态计算逻辑。
// ============================================================

import { useEffect, useState } from "react";
import {
  login,
  loginAsGuest,
  getRememberedUser,
  setRememberedUser,
  type AuthState,
} from "@/lib/auth";

const MIN_USER = 2;
const MAX_USER = 10;
const MIN_PW = 4;
const MAX_PW = 20;

type LoginModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: (auth: AuthState) => void;
};

export default function LoginModal({ open, onClose, onSuccess }: LoginModalProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  // 每次打开重置表单，并预填「记住的账号」
  useEffect(() => {
    if (open) {
      setUsername(getRememberedUser());
      setPassword("");
      setRemember(false);
      setError(null);
      setTouched(false);
    }
  }, [open]);

  if (!open) return null;

  const userLen = username.trim().length;
  const pwLen = password.length;
  const userValid = userLen >= MIN_USER && userLen <= MAX_USER;
  const pwValid = pwLen >= MIN_PW && pwLen <= MAX_PW;
  const valid = userValid && pwValid;

  const showFormatHint = touched && !valid && !error;
  const hint = error ?? (showFormatHint ? `账号需 ${MIN_USER}-${MAX_USER} 位，密码需 ${MIN_PW}-${MAX_PW} 位` : "");

  const handleSubmit = () => {
    setTouched(true);
    if (!valid) {
      setError(null);
      return;
    }
    const name = username.trim();
    const res = login(name, password);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (remember) setRememberedUser(name);
    else setRememberedUser("");
    onSuccess({ mode: "user", username: name });
    onClose();
  };

  const handleGuest = () => {
    loginAsGuest();
    onSuccess({ mode: "guest", username: null });
    onClose();
  };

  return (
    <div className="eden-modal-overlay" onClick={onClose}>
      <div
        className="eden-modal"
        role="dialog"
        aria-modal="true"
        aria-label="登录或注册"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="eden-modal-header">
          <span className="eden-modal-title">登录 / 注册</span>
          <button className="eden-modal-close" type="button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        <div className="eden-modal-body">
          <input
            className="eden-modal-input"
            type="text"
            value={username}
            maxLength={MAX_USER}
            placeholder={`账号（${MIN_USER}-${MAX_USER} 位）`}
            aria-label="账号"
            data-testid="login-modal-username"
            onChange={(e) => {
              setUsername(e.target.value);
              if (error) setError(null);
            }}
            onBlur={() => setTouched(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
          />
          <input
            className="eden-modal-input"
            type="password"
            value={password}
            maxLength={MAX_PW}
            placeholder={`密码（${MIN_PW}-${MAX_PW} 位）`}
            aria-label="密码"
            data-testid="login-modal-password"
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
            onBlur={() => setTouched(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
          />

          <label className="eden-modal-checkbox-row">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            记住账号
          </label>

          <div className="eden-modal-error" data-testid="login-modal-error">
            {hint}
          </div>

          <div className="eden-modal-actions">
            <button
              className="eden-btn eden-btn--primary"
              type="button"
              onClick={handleSubmit}
              disabled={!valid}
              data-testid="login-modal-submit"
            >
              进入冒险
            </button>
            <button
              className="eden-btn eden-btn--ghost"
              type="button"
              onClick={handleGuest}
              data-testid="login-modal-guest"
            >
              游客模式
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
