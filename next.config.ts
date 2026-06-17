import type { NextConfig } from "next";
import { IMAGE_REMOTE_PATTERNS } from "./lib/image-remote-hosts";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: IMAGE_REMOTE_PATTERNS,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/:path*",
      },
    ];
  },
};

export default nextConfig;
