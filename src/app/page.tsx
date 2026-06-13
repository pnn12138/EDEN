import Link from "next/link";
import Image from "next/image";
import { CHAPTER0_IMAGES } from "@/game/assets";

export default function HomePage() {
  return (
    <div className="eden-game eden-game--home">
      {/* 背景 */}
      <div className="eden-bg">
        <Image
          src={CHAPTER0_IMAGES.edenBackground}
          alt="伊甸园"
          fill
          priority
          sizes="100vw"
          style={{ objectFit: "cover" }}
        />
        <div className="eden-bg-overlay" />
      </div>

      {/* 游戏入口内容 */}
      <main style={{ position: "relative", zIndex: 5 }}>
        <section className="home-container">
          <h1>EDEN</h1>
          <p className="home-subtitle">Chapter 0 · 初次堕落</p>
          <p className="home-tagline">
            你是蛇。
          </p>
          <p className="home-description">
            在伊甸园的树影下，你的低语将改变夏娃的命运。
          </p>
          <Link
            href="/game"
            className="eden-btn eden-btn--primary"
            style={{ textDecoration: "none", marginTop: 0, padding: "14px 40px", fontSize: "1.05rem" }}
          >
            进入伊甸园
          </Link>
        </section>
      </main>
    </div>
  );
}
