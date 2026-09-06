import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fail the production build on type errors instead of silently shipping
  typescript: { ignoreBuildErrors: false },
  // Native module used for argon2id hashing must stay external to the server bundle
  serverExternalPackages: ["@node-rs/argon2"],
};

export default nextConfig;
