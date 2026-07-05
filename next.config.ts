import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle so the Docker image only needs the
  // standalone output plus static assets — no full node_modules at runtime.
  output: "standalone",
};

export default nextConfig;
