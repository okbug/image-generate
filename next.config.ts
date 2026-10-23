import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // /root 下有别的 package-lock.json，不固定的话 Next 会把 /root 当成根目录，
  // standalone 产物会变成 .next/standalone/projects/image-generate/server.js
  // 直接用 __dirname，别包 path.join：配置里出现 fs/path 调用会让 Turbopack 把整个项目追踪进产物
  outputFileTracingRoot: __dirname,
  turbopack: { root: __dirname },
  experimental: {
    optimizePackageImports: ["antd", "@ant-design/icons"],
  },
};

export default nextConfig;
