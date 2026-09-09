import type { NextConfig } from "next";

// React dev mode uses eval() to reconstruct call stacks, so the strict
// production CSP (no unsafe-eval) has to be relaxed for local development.
// Production React never calls eval, so the shipped policy stays strict.
const scriptSrc = ["'self'", "'unsafe-inline'"];
if (process.env.NODE_ENV === "development") scriptSrc.push("'unsafe-eval'");

const securityHeaders = [
  // No MIME sniffing; the declared content type is authoritative
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Do not let this document be framed by another origin (clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  // Keep referrers to same-origin, so the panel origin is never leaked out
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The panel is all-server-rendered; scripts are only same-origin or next's inline
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src ${scriptSrc.join(" ")}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  // Disallow the site to be embedded; belt and braces on top of X-Frame-Options
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
];

const nextConfig: NextConfig = {
  // Never advertise the Next.js version in a response header
  poweredByHeader: false,
  // Fail the production build on type errors instead of silently shipping
  typescript: { ignoreBuildErrors: false },
  // Native module used for argon2id hashing must stay external to the server bundle
  serverExternalPackages: ["@node-rs/argon2"],
  experimental: {
    // Lets a layout answer 403 with forbidden() instead of redirecting (§13.2)
    authInterrupts: true,
  },
  // These data files are read at runtime, so tracing must keep them
  outputFileTracingIncludes: {
    "/**": ["./data/**", "./assets/fonts/**", "./drizzle/**"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
