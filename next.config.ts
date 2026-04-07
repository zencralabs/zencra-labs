import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [],
  },
  trailingSlash: false,
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;