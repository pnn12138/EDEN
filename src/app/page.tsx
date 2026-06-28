"use client";

import Link from "next/link";
import Image from "next/image";
import { CHAPTER0_IMAGES } from "@/game/assets";

export default function HomePage() {
  return (
    <div className="eden-game eden-game--home">
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

      <main style={{ position: "relative", zIndex: 5 }}>
        <section className="home-container">
          <h1>EDEN</h1>
          <p className="home-subtitle">第一章 · 园中诸声</p>
          <p className="home-tagline">
            你是一条蛇。语言是你唯一的武器。
          </p>
          <p className="home-description">
            探索伊甸园，收集线索与回响，通过低语影响夏娃的判断。她会不会自己伸手摘下那枚果子——取决于你说的每一句话。
          </p>
          <div className="home-entry-list">
            <Link
              href="/world"
              className="eden-btn eden-btn--primary"
              style={{ textDecoration: "none", marginTop: 0, padding: "14px 40px", fontSize: "1.05rem" }}
            >
              进入伊甸园
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
