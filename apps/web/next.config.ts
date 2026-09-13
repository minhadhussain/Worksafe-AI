import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// Both host services share the repository-root .env. Compose supplies env directly.
loadEnvConfig(resolve(process.cwd(), "../.."), process.env.NODE_ENV === "development", console, true);

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Worker devices must never provide a camera or microphone feed.
          { key: "Permissions-Policy", value: "camera=(), microphone=()" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
