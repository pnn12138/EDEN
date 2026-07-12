"use client";

// 全局运行时错误边界：可重试，不暴露堆栈 / 技术细节。黑金风格。
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 仅记录摘要，不向玩家暴露原始错误
    console.error("[eden] page error:", error?.message ?? "unknown");
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "20px",
        background: "radial-gradient(circle at 50% 30%, #1a1d16 0%, #0c0d0a 70%)",
        color: "#cdb079",
        fontFamily: "ui-serif, Georgia, 'Times New Roman', serif",
        textAlign: "center",
        padding: "24px",
      }}
    >
      <h1 style={{ fontSize: "1.8rem", margin: 0, letterSpacing: "0.12em" }}>
        园中起了风
      </h1>
      <p style={{ opacity: 0.85, maxWidth: "26rem", lineHeight: 1.7 }}>
        声音暂时听不清了。你可以稍后重试，或返回入口重新开始。
      </p>
      <div style={{ display: "flex", gap: "12px" }}>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: "10px 22px",
            borderRadius: "8px",
            border: "1px solid rgba(205, 176, 121, 0.5)",
            background: "transparent",
            color: "#f0dca0",
            cursor: "pointer",
            letterSpacing: "0.1em",
          }}
        >
          重试
        </button>
        <a
          href="/"
          style={{
            padding: "10px 22px",
            borderRadius: "8px",
            border: "1px solid rgba(205, 176, 121, 0.3)",
            color: "#cdb079",
            textDecoration: "none",
            letterSpacing: "0.1em",
          }}
        >
          返回入口
        </a>
      </div>
    </div>
  );
}
