import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "oura-api.oura-events.workers.dev", pathname: "/media/**" },
    ],
  },
};

export default nextConfig;
