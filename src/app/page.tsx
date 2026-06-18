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
          <p className="home-subtitle">Chapter 0 · 初次堕落</p>
          <p className="home-tagline">
            园中尚无疑问。
          </p>
          <p className="home-description">
            第一声低语，还未被听见。
          </p>
          <Link
            href="/game"
            className="eden-btn eden-btn--primary"
            style={{ textDecoration: "none", marginTop: 0, padding: "14px 40px", fontSize: "1.05rem" }}
          >
            进入园中
          </Link>
        </section>
      </main>
    </div>
  );
}
