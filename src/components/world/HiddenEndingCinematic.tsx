"use client";

// ============================================================
// 第一章三位天使隐藏结局过场组件
//
// 职责：
// - 按 beatIndex 渲染当前 beat 文案 + 对应帧图片
// - 点击 / Enter / Space 推进；Escape / 跳过按钮直接完成
// - 图片按路径独立记录失败态：第一张 404 不阻止第二张加载
// - 图片失败时保留 tone 背景与全文文案，闭环仍可达
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

  return (
    <section
      className={`eden-hidden-ending-cinematic eden-hidden-ending-cinematic--${content.tone}`}
      data-testid="hidden-ending-cinematic"
      onClick={advance}
    >
      {!imageFailed && (
        <Image
          key={currentFrame.image}
          src={currentFrame.image}
          alt={currentFrame.imageAlt}
          fill
          priority
          sizes="100vw"
          style={{ objectFit: "cover" }}
          onError={() =>
            setFailedImages((value) => ({ ...value, [currentFrame.image]: true }))
          }
        />
      )}
      <div className="eden-hidden-ending-cinematic__shade" />
      <div className="eden-hidden-ending-cinematic__copy">
        <p className="eden-hidden-ending-cinematic__kicker">隐藏结局</p>
        <h1 className="eden-hidden-ending-cinematic__title">{content.title}</h1>
        <p
          className="eden-hidden-ending-cinematic__beat"
          data-testid="hidden-ending-beat"
        >
          {content.beats[beatIndex]}
        </p>
        <span className="eden-hidden-ending-cinematic__progress">
          {beatIndex + 1} / {content.beats.length}
        </span>
      </div>
      <button
        type="button"
        className="eden-hidden-ending-cinematic__skip"
        data-testid="hidden-ending-skip"
        onClick={(event) => {
          event.stopPropagation();
          onComplete();
        }}
      >
        跳过过场
      </button>
    </section>
  );
}
