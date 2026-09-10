import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      // Fonts are self-hosted via next/font/google (no runtime CDN calls),
      // and the app has no other external script/style dependency, so this
      // is a real allowlist, not a rubber stamp. 'unsafe-inline' on script
      // is required for Next.js's own hydration/RSC inline scripts; a
      // nonce-based CSP would remove it but needs per-request middleware,
      // which is more setup than justified for the current deadline.
      { key: "Content-Security-Policy", value: [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "worker-src 'self' blob:",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; ") },
    ] }];
  },
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
