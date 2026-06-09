export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-6xl font-bold mb-8">EDEN</h1>
      <p className="text-xl mb-8">AI 叙事游戏</p>
      <a
        href="/game"
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      >
        进入 Demo
      </a>
    </main>
  );
}
