import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This is required for Docker deployments to keep the image small
  output: "standalone", 
  
  // We need this so the container allows images from external sources if you use them
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;