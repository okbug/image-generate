import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "一键配置 · AI 图片工坊",
};

export default function DemoLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
