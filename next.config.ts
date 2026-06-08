import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "s.yimg.com", pathname: "/**" },
      { protocol: "https", hostname: "media.zenfs.com", pathname: "/**" },
      { protocol: "https", hostname: "image.cnbcfm.com", pathname: "/**" },
      { protocol: "https", hostname: "images.wsj.net", pathname: "/**" },
      { protocol: "https", hostname: "images.barrons.com", pathname: "/**" },
      { protocol: "https", hostname: "images.marketwatch.com", pathname: "/**" },
      { protocol: "https", hostname: "static.seekingalpha.com", pathname: "/**" },
      { protocol: "https", hostname: "images.reuters.com", pathname: "/**" },
      { protocol: "https", hostname: "www.reuters.com", pathname: "/**" },
      { protocol: "https", hostname: "assets.bwbx.io", pathname: "/**" },
      { protocol: "https", hostname: "www.bloomberg.com", pathname: "/**" },
    ],
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
