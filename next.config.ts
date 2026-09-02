import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // 允许用 NEXT_DIST_DIR 把构建产物写到别的目录（如 .next-dev），
  // 避免在同一目录里 build 时覆盖掉正在跑的生产产物 .next/standalone
  distDir: process.env.NEXT_DIST_DIR?.trim() || ".next",
  // dev 模式下 Next 默认只允许 localhost 请求 /_next/* 这类 dev 资源，
  // 用服务器 IP / 域名访问时客户端 JS 会被拦截，页面能渲染但无法交互。
  // 逗号分隔，可用 ALLOWED_DEV_ORIGINS 覆盖。仅影响 next dev。
  allowedDevOrigins: (
    process.env.ALLOWED_DEV_ORIGINS ??
    "104.224.153.52,image.fe.sb,image.131438.xyz"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  experimental: {
    optimizePackageImports: ["antd", "@ant-design/icons"],
  },
};

export default nextConfig;
