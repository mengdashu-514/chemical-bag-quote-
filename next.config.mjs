/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // Docker 自托管走 standalone 产物，可把镜像从 ~700MB 瘦到 ~150MB；
  // Vercel 部署会忽略此选项，所以两边能共用同一份 next.config.mjs。
  output: "standalone",
};

export default nextConfig;
