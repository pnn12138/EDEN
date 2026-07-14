"use client";

// ============================================================
// 第一章：结局记忆面板（Task 7 Step 4）
//
// 在结局复盘底部提供两个入口：
// - 「把这次经历留在园外 · 图片集」：请求分镜 + 图片；失败回退文字分镜。
//
// 媒体自定义配置仅来自 sessionStorage（loadEndingMediaSettings），本次请求使用，
// 不写入游戏存档、URL、日志。任何失败都提供「重试 / 打开设置 / 保留文字分镜」。
// ============================================================

import { useState } from "react";
import type { EdenWorldState } from "@/game/world/types";
import {
  loadEndingMediaSettings,
} from "@/lib/endingMediaSettings";

type StoryboardFrame = { title: string; caption: string };
type Storyboard = {
  title: string;
  summary: string;
  imageCount: number;
  frames: StoryboardFrame[];
};
type MediaResponse = {
  ok: boolean;
  storyboard?: Storyboard;
  images?: Array<string | null>;
  imagesAvailable?: boolean;
  imageError?: string;
  error?: string;
};

type PanelState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "done"; data: MediaResponse }
  | { phase: "error"; message: string };

export default function EndingMemoryPanel({
  state,
  onOpenAiSettings,
}: {
  state: EdenWorldState;
  onOpenAiSettings?: () => void;
}) {
  const [panel, setPanel] = useState<PanelState>({ phase: "idle" });

  const downloadImage = async (imageUrl: string, index: number) => {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error("download_failed");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `eden-adventure-${index + 1}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(imageUrl, "_blank", "noopener,noreferrer");
    }
  };

  const requestMemory = async () => {
    setPanel({ phase: "loading" });
    const media = loadEndingMediaSettings();
    const controller = new AbortController();
    // 图片服务单张允许 90 秒；并行生成与分镜整理预留总时限，避免界面永久停在“正在生成”。
    const timeout = window.setTimeout(() => controller.abort(), 180_000);
    try {
      const res = await fetch("/api/world/ending-media", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state, mediaSettings: media }),
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => null)) as MediaResponse | null;
      if (!res.ok || !data || !data.ok) {
        setPanel({ phase: "error", message: data?.error || "图片服务暂时不可用" });
        return;
      }
      setPanel({ phase: "done", data });
    } catch (error) {
      setPanel({ phase: "error", message: error instanceof DOMException && error.name === "AbortError" ? "生成等待超时" : "网络错误" });
    } finally {
      window.clearTimeout(timeout);
    }
  };

  return (
    <section className="eden-ending-memory">
      <h3 className="eden-segment-title">把这次经历留在园外</h3>

      <div className="eden-ending-memory-actions">
        <button
          type="button"
          className="eden-btn eden-btn--primary"
          onClick={requestMemory}
          disabled={panel.phase === "loading"}
          data-testid="ending-memory-generate"
        >
          {panel.phase === "loading" ? "正在生成…" : "生成本次冒险的图片"}
        </button>

      </div>

      {panel.phase === "loading" && (
        <div className="eden-ending-memory-loading" role="status">
          正在整理经历并并行生成画面（最多 6 张，通常约需 1–2 分钟）…
        </div>
      )}

      {panel.phase === "done" && (
        <div className="eden-ending-memory-result">
          {panel.data.storyboard && (
            <div className="eden-ending-memory-story">
              <p className="eden-ending-memory-story-title">{panel.data.storyboard.title}</p>
              {panel.data.storyboard.summary && (
                <p className="eden-ending-memory-story-summary">{panel.data.storyboard.summary}</p>
              )}
              <div className="eden-ending-memory-cards">
                {panel.data.storyboard.frames.map((frame, idx) => {
                  const img = panel.data.images?.[idx];
                  return (
                    <figure key={idx} className="eden-ending-memory-card">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt={frame.title} className="eden-ending-memory-card-img" />
                      ) : (
                        <div className="eden-ending-memory-card-text" aria-label="文字分镜" data-testid="ending-memory-card-text">
                          <span className="eden-ending-memory-card-kicker">文字分镜</span>
                        </div>
                      )}
                      <figcaption className="eden-ending-memory-card-cap">
                        <strong>{frame.title}</strong>
                        <span>{frame.caption}</span>
                        {img && (
                          <button
                            type="button"
                            className="eden-ending-memory-download"
                            onClick={() => downloadImage(img, idx)}
                          >
                            下载图片
                          </button>
                        )}
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
              {!panel.data.imagesAvailable && (!panel.data.images || panel.data.images.length === 0) && (
                <p className="eden-ending-memory-fallback-note">
                  未配置图像生成服务，已为你保留文字分镜。
                </p>
              )}
              {panel.data.imageError && (
                <p className="eden-ending-memory-fallback-note">
                  {panel.data.imageError}
                </p>
              )}
            </div>
          )}

        </div>
      )}

      {panel.phase === "error" && (
        <div className="eden-ending-memory-error" role="alert">
          <p>生成失败：{panel.message}。你可以：</p>
          <div className="eden-ending-memory-error-actions">
            <button type="button" className="eden-btn eden-btn--ghost" onClick={requestMemory}>
              重试
            </button>
            <button
              type="button"
              className="eden-btn eden-btn--ghost"
              onClick={() => onOpenAiSettings?.()}
              data-testid="ending-memory-open-settings"
            >
              打开设置
            </button>
            <span className="eden-ending-memory-keep">已保留文字分镜</span>
          </div>
        </div>
      )}
    </section>
  );
}
