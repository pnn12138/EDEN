import Link from "next/link";

export default function Ending() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">结局页占位</h1>
      <p className="text-xl mt-4">后续将展示 Chapter 0 的不同结局</p>
      <Link
        href="/"
        className="mt-8 bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
      >
        返回首页
      </Link>
    </main>
  );
}
