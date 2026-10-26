import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { AntdProvider } from "@/components/AntdProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 标题用的衬线体，中文回落到系统宋体（见 globals.css 的 --font-serif）
const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI 图片工坊",
  description: "用一句话生成专属画作",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 禁止移动端缩放；iOS Safari 会忽略 user-scalable，另见下方内联脚本和 globals.css 的 touch-action
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f5" },
    { media: "(prefers-color-scheme: dark)", color: "#262624" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // 下面的内联脚本会在 hydrate 前给 <html> 加 dark 类，属预期差异
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.add('dark');}}catch(_){}" +
              // iOS Safari 不认 user-scalable=no，拦掉双指缩放手势
              "document.addEventListener('gesturestart',function(e){e.preventDefault();},{passive:false});",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <AntdRegistry>
          <AntdProvider>{children}</AntdProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
