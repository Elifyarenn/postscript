import type { NextConfig } from "next";

// Cloudflare Turnstile guards the registration forms against bots (D-111)
const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

// The front page playlist is played in Spotify's own player, loaded on request (D-117)
const SPOTIFY_ORIGIN = "https://open.spotify.com";

// React dev mode uses eval() to reconstruct call stacks, so the strict
// production CSP (no unsafe-eval) has to be relaxed for local development.
// Production React never calls eval, so the shipped policy stays strict.
const scriptSrc = ["'self'", "'unsafe-inline'", TURNSTILE_ORIGIN];
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
      // Turnstile and the Spotify player both render inside frames served by their owners
      `frame-src ${TURNSTILE_ORIGIN} ${SPOTIFY_ORIGIN}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  // Stop Flash/PDF readers from loading a cross-domain policy file from this origin
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  // No page uses a device or browser capability and nothing is embedded (D-101),
  // so an injected script cannot ask the reader for camera, location and the like
  {
    key: "Permissions-Policy",
    value: [
      "accelerometer=()",
      "autoplay=()",
      "bluetooth=()",
      "browsing-topics=()",
      "camera=()",
      "display-capture=()",
      "geolocation=()",
      "gyroscope=()",
      "hid=()",
      "magnetometer=()",
      "microphone=()",
      "midi=()",
      "payment=()",
      "serial=()",
      "usb=()",
    ].join(", "),
  },
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
    // The edit-profile dialog sends both pictures in one save (D-160): two 5 MB
    // files plus the multipart framing and the text fields. The default 1 MB
    // refused any photo over 1 MB. Each picture's own 5 MB rule stays in the service.
    serverActions: {
      bodySizeLimit: "11mb",
    },
    // src/proxy.ts buffers every request body and cuts it at 10 MB by default,
    // which would truncate the same two-picture save before the action saw it
    proxyClientMaxBodySize: "11mb",
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
