import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Allow LAN access during dev (e.g. http://10.0.0.231:3001)
  allowedDevOrigins: ["10.0.0.231:3001"],
};

export default nextConfig;
