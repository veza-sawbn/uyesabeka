import type { NextConfig } from "next";

// API calls go directly to the Render-hosted FastAPI backend, so no rewrites
// are needed here (spec §10.2).
const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
