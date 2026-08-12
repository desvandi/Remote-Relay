import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Production: fail build on TypeScript errors (do NOT ignore)
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
};

export default nextConfig;
