import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
