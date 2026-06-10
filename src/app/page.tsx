import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <section>
        <h1>EDEN</h1>
        <p>AI 叙事游戏</p>
        <p>玩家将在 Chapter 0 中扮演蛇，通过对话影响夏娃。</p>
        <Link href="/game">进入 Demo</Link>
      </section>
    </main>
  );
}
