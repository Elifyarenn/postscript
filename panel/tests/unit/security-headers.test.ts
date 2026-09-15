import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

// The headers live in config, not code paths a test would otherwise touch;
// a silent deletion would only show up in a live response (D-101)
async function headerMap() {
  const rules = (await nextConfig.headers?.()) ?? [];
  const catchAll = rules.find((rule) => rule.source === "/:path*");
  return new Map((catchAll?.headers ?? []).map((h) => [h.key, h.value]));
}

describe("security headers", () => {
  it("applies every security header to all paths", async () => {
    const headers = await headerMap();
    for (const key of [
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
      "Content-Security-Policy",
      "X-Permitted-Cross-Domain-Policies",
      "Permissions-Policy",
    ]) {
      expect(headers.has(key), key).toBe(true);
    }
  });

  it("denies device and tracking features", async () => {
    const policy = (await headerMap()).get("Permissions-Policy") ?? "";
    for (const feature of ["camera", "microphone", "geolocation", "payment", "browsing-topics"]) {
      expect(policy).toContain(`${feature}=()`);
    }
  });

  it("lets in only Turnstile (script and frame) and the Spotify player frame (D-111, D-117)", async () => {
    const csp = (await headerMap()).get("Content-Security-Policy") ?? "";
    const directive = (name: string) => csp.split("; ").find((part) => part.startsWith(`${name} `)) ?? "";

    expect(directive("script-src")).toContain("https://challenges.cloudflare.com");
    expect(directive("frame-src")).toBe("frame-src https://challenges.cloudflare.com https://open.spotify.com");
    expect(directive("script-src")).not.toContain("spotify");
    expect(directive("default-src")).toBe("default-src 'self'");
    expect(directive("connect-src")).toBe("connect-src 'self'");
  });

  it("never allows the page to be framed", async () => {
    const headers = await headerMap();
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  });

  it("does not advertise the framework", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
