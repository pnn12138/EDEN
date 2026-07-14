"use client";

// ============================================================
// 第一章结局过场组件
//
// 设计原则：完全复刻开局引言（intro beat）的布局与样式，
// 仅替换背景图、文案内容与底部按钮文字。
// ============================================================

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import type { HiddenEndingCinematicContent } from "@/content/world/hiddenEndings";

type Props = {
  content: HiddenEndingCinematicContent;
  onComplete: () => void;
};

export default function HiddenEndingCinematic({ content, onComplete }: Props) {
  const [beatIndex, setBeatIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // 选中当前帧：按 startBeat 从大到小取第一个 <= beatIndex 的帧；兜底为第一帧。
  const currentFrame =
    [...content.frames]
      .sort((a, b) => b.startBeat - a.startBeat)
      .find((frame) => beatIndex >= frame.startBeat) ?? content.frames[0];

  const advance = useCallback(() => {
    if (beatIndex >= content.beats.length - 1) {
      onComplete();
    } else {
      setBeatIndex((value) => value + 1);
    }
  }, [beatIndex, content.beats.length, onComplete]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        advance();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onComplete();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advance, onComplete]);

  const imageFailed = failedImages[currentFrame.image] === true;
  const isLastBeat = beatIndex >= content.beats.length - 1;

  // 将标题+正文拼成与 intro beat 相同的多行文本格式
  const lines = [`第一章 · 结局`, content.title, "", content.beats[beatIndex], `${beatIndex + 1} / ${content.beats.length}`];

  return (
    <div
      className={`eden-game eden-game--intro eden-hidden-ending-cinematic eden-hidden-ending-cinematic--${content.tone}`}
      data-testid="hidden-ending-cinematic"
      onClick={advance}
    >
      {/* 背景图层 — 与开局一致的结构 */}
      <div className="eden-bg">
        {!imageFailed && (
          <Image
            key={currentFrame.image}
            src={currentFrame.image}
            alt={currentFrame.imageAlt}
            fill
            priority
            sizes="100vw"
            style={{ objectFit: "cover", maxWidth: "100vw", maxHeight: "100vh" }}
            onError={() =>
              setFailedImages((value) => ({ ...value, [currentFrame.image]: true }))
            }
          />
        )}
        {/* 复刻开局的暗角遮罩 */}
        <div className="eden-bg-overlay eden-bg-overlay--intro" />
      </div>

      {/* 顶栏 — 与开局一致的 header 结构，右侧为跳过按钮 */}
      <header className="eden-header" onClick={(e) => e.stopPropagation()}>
        <div className="eden-header-left">
          <h1 className="eden-title">EDEN</h1>
          <span className="eden-chapter-tag">第一章 · 园中诸声 · 结局</span>
        </div>
        <button
          type="button"
          className="eden-btn--beat-advance"
          style={{ maxWidth: "140px", padding: "8px 20px", fontSize: "0.9rem", lineHeight: "1.4" }}
          data-testid="hidden-ending-skip"
          onClick={(event) => {
            event.stopPropagation();
            onComplete();
          }}
        >
          跳过过场
        </button>
      </header>

      {/* 文字框 — 与开局完全一致的 intro beat 结构 */}
      <main className="eden-intro-beat-main">
        <div className="eden-intro-beat-content">
          <div className="eden-intro-beat-text" key={`ending-beat-${beatIndex}`}>
            {lines.map((line, i) => (
              <p key={i} className={`eden-beat-line ${line === "" ? "eden-beat-line--blank" : ""}`}>
                {line}
              </p>
            ))}
          </div>
        </div>
      </main>

      {/* 底部推进按钮 — 与开局一致的 footer 结构 */}
      <footer className="eden-intro-beat-footer" onClick={(e) => e.stopPropagation()}>
        <button
          className="eden-btn eden-btn--primary eden-btn--beat-advance"
          onClick={advance}
        >
          {isLastBeat ? "查看复盘" : "继续"}
        </button>
      </footer>
    </div>
  );
}
