// 404 页面：可回首页，不露任何技术栈信息。黑金风格。
import Link from "next/link";

export default function NotFound() {
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
      <h1 style={{ fontSize: "2.4rem", margin: 0, letterSpacing: "0.15em" }}>404</h1>
      <p style={{ opacity: 0.85, maxWidth: "26rem", lineHeight: 1.7 }}>
        这片园子还没有被开辟。也许你走错了路。
      </p>
      <Link
        href="/"
        style={{
          padding: "10px 22px",
          borderRadius: "8px",
          border: "1px solid rgba(205, 176, 121, 0.5)",
          color: "#f0dca0",
          textDecoration: "none",
          letterSpacing: "0.1em",
        }}
      >
        返回伊甸园入口
      </Link>
    </div>
  );
}
