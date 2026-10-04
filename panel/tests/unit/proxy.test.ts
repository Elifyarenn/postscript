/**
 * The proxy only mints the CSRF cookie, so it is skipped once that cookie
 * exists (D-308). Next reads the matcher statically, which is why it holds the
 * cookie name as a literal; if it drifts from the name the actions check, the
 * proxy would either run on every request again or never hand out the cookie.
 */
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { CSRF_COOKIE } from "@/lib/csrf";
import { config, proxy } from "@/proxy";

describe("proxy matcher", () => {
  it("is skipped when the CSRF cookie the actions check is already there", () => {
    const [rule] = config.matcher;
    expect(rule!.missing).toEqual([{ type: "cookie", key: CSRF_COOKIE }]);
  });

  it("leaves out static files and every API route", () => {
    const source = new RegExp(`^${config.matcher[0]!.source}$`);
    for (const path of ["/_next/static/x.js", "/favicon.ico", "/api/public/articles", "/api/issue-pages/a/media/b"]) {
      expect(source.test(path)).toBe(false);
    }
    for (const path of ["/", "/login", "/sayilar/1"]) {
      expect(source.test(path)).toBe(true);
    }
  });
});

describe("proxy", () => {
  it("hands out the cookie to a first visit", () => {
    const response = proxy(new NextRequest("https://www.postscriptmag.com/login"));
    expect(response.cookies.get(CSRF_COOKIE)?.value).toMatch(/^[0-9a-f]{64}$/);
  });

  it("does not replace a cookie that is already there", () => {
    const request = new NextRequest("https://www.postscriptmag.com/login", {
      headers: { cookie: `${CSRF_COOKIE}=${"a".repeat(64)}` },
    });
    expect(proxy(request).cookies.get(CSRF_COOKIE)).toBeUndefined();
  });
});
