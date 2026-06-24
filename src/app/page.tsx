import Link from "next/link";
import Image from "next/image";
import { CHAPTER0_IMAGES } from "@/game/assets";

export default function HomePage() {
  return (
    <div className="eden-game eden-game--home">
      {/* 背景 */}
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

      {/* 游戏入口内容 */}
      <main style={{ position: "relative", zIndex: 5 }}>
        <section className="home-container">
          <h1>EDEN</h1>
          <p className="home-subtitle">第二伊甸园 · 复刻计划</p>
          <p className="home-tagline">
            未来研究人员复刻了伊甸园的故事。
          </p>
          <p className="home-description">
            他们希望在这段古老叙事里，找到让人工智能从服从命令走向自我意识的途径。
          </p>
          <div className="home-entry-list">
            <Link
              href="/game"
              className="eden-btn eden-btn--primary"
              style={{ textDecoration: "none", marginTop: 0, padding: "14px 40px", fontSize: "1.05rem" }}
            >
              启动初次观测
            </Link>
            <Link
              href="/world"
              className="eden-btn eden-btn--primary"
              style={{ textDecoration: "none", marginTop: 0, padding: "14px 40px", fontSize: "1.05rem" }}
            >
              进入第二轮复刻
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
