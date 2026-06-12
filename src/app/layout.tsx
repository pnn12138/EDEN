import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EDEN",
  description: "叙事游戏",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
