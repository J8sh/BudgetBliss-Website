import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // Sharp and mongoose run server-side only
  serverExternalPackages: ["mongoose", "sharp", "pino", "pino-pretty", "heic-convert", "heic-decode", "libheif-js"],

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
      {
        // Never cache authenticated pages — prevents serving stale authed HTML to unauthenticated users
        source: "/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
