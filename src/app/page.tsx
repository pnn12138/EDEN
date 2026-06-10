import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-6xl font-bold mb-8">EDEN</h1>
      <p className="text-xl mb-4">AI 叙事游戏</p>
      <p className="text-base mb-8 text-gray-400">
        玩家将在 Chapter 0 中扮演蛇，通过对话影响夏娃
      </p>
      <Link
        href="/game"
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      >
        进入 Demo
      </Link>
    </main>
  );
}
