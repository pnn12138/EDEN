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

      {/* 内容 */}
      <main style={{ position: "relative", zIndex: 5 }}>
        <section className="home-container">
          <h1>EDEN</h1>
          <p>叙事游戏</p>
          <p>玩家将在 Chapter 0 中扮演蛇，通过对话影响夏娃。</p>
          <Link href="/game" className="eden-btn eden-btn--primary" style={{ textDecoration: "none", marginTop: 24 }}>
            进入 Demo
          </Link>
        </section>
      </main>
    </div>
  );
}
