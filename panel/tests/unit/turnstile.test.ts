import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCache } from "@/lib/env";
import { isAppError } from "@/lib/errors";
import { assertHuman, setBotCheckFetcher, turnstileSiteKey } from "@/lib/turnstile";

const KEYS = { TURNSTILE_SITE_KEY: "site-key", TURNSTILE_SECRET_KEY: "secret-key" };

function answer(body: unknown) {
  const fetcher = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
  setBotCheckFetcher(fetcher);
  return fetcher;
}

async function refused(promise: Promise<unknown>): Promise<boolean> {
  try {
    await promise;
    return false;
  } catch (error) {
    return isAppError(error) && error.status === 400;
  }
}

function configure(keys: Partial<typeof KEYS>) {
  delete process.env.TURNSTILE_SITE_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;
  Object.assign(process.env, keys);
  resetEnvCache();
}

beforeEach(() => configure(KEYS));

afterEach(() => {
  configure({});
  vi.restoreAllMocks();
});

describe("assertHuman", () => {
  it("is skipped while the keys are not both set, so a deploy cannot close registration", async () => {
    configure({ TURNSTILE_SITE_KEY: "site-key" });
    const fetcher = answer({ success: false });

    await expect(assertHuman(undefined, null, "register")).resolves.toBeUndefined();
    expect(fetcher).not.toHaveBeenCalled();
    expect(turnstileSiteKey()).toBeNull();
  });

  it("passes a token Cloudflare confirms for the same action, sending the secret and IP", async () => {
    const fetcher = answer({ success: true, action: "register" });

    await expect(assertHuman("token", "203.0.113.10", "register")).resolves.toBeUndefined();

    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(JSON.parse(String(init.body))).toEqual({
      secret: "secret-key",
      response: "token",
      remoteip: "203.0.113.10",
    });
    expect(turnstileSiteKey()).toBe("site-key");
  });

  it("refuses a missing or oversized token without asking Cloudflare", async () => {
    const fetcher = answer({ success: true });

    expect(await refused(assertHuman("", null, "register"))).toBe(true);
    expect(await refused(assertHuman("x".repeat(2049), null, "register"))).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("refuses a token Cloudflare rejects", async () => {
    answer({ success: false, "error-codes": ["invalid-input-response"] });
    expect(await refused(assertHuman("token", null, "register"))).toBe(true);
  });

  it("refuses a token solved on another form", async () => {
    answer({ success: true, action: "resend_verification" });
    expect(await refused(assertHuman("token", null, "register"))).toBe(true);
  });

  it("fails closed when Cloudflare cannot be reached", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setBotCheckFetcher(async () => {
      throw new Error("network down");
    });
    expect(await refused(assertHuman("token", null, "register"))).toBe(true);
  });
});
