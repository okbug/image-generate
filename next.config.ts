import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // 允许用 NEXT_DIST_DIR 把构建产物写到别的目录（如 .next-dev），
  // 避免在同一目录里 build 时覆盖掉正在跑的生产产物 .next/standalone
  distDir: process.env.NEXT_DIST_DIR?.trim() || ".next",
  experimental: {
    optimizePackageImports: ["antd", "@ant-design/icons"],
  },
};

export default nextConfig;
