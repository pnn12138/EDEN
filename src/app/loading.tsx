// 全局加载态（路由切换 / 数据准备）。黑金风格，与游戏一致。
export default function Loading() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "18px",
        background: "radial-gradient(circle at 50% 30%, #1a1d16 0%, #0c0d0a 70%)",
        color: "#cdb079",
        fontFamily: "ui-serif, Georgia, 'Times New Roman', serif",
      }}
    >
      <div
        style={{
          width: "42px",
          height: "42px",
          borderRadius: "50%",
          border: "2px solid rgba(205, 176, 121, 0.25)",
          borderTopColor: "#cdb079",
          animation: "eden-spin 0.9s linear infinite",
        }}
      />
      <p style={{ letterSpacing: "0.3em", fontSize: "0.85rem", opacity: 0.85 }}>
        伊甸园正在苏醒……
      </p>
      <style>{`@keyframes eden-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
