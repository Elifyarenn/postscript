/**
 * The sender checks (D-269): production never sends from a reserved domain
 * such as `.local`, while development and tests may.
 */
import { describe, expect, it } from "vitest";
import { isReservedAddress, mailConfigProblems, senderAddress } from "@/lib/mail/config";

const production = {
  nodeEnv: "production",
  mailFrom: "postscript <noreply@postscriptmag.com>",
  smtpHost: "smtp.resend.com",
  smtpUser: "resend",
  smtpPassword: "re_secret",
};

describe("senderAddress", () => {
  it("reads the address from a named or a bare sender", () => {
    expect(senderAddress("postscript <noreply@postscriptmag.com>")).toBe("noreply@postscriptmag.com");
    expect(senderAddress("noreply@postscriptmag.com")).toBe("noreply@postscriptmag.com");
    expect(senderAddress("postscript")).toBeNull();
    expect(senderAddress("postscript <>")).toBeNull();
  });
});

describe("isReservedAddress", () => {
  it("knows the domains that never deliver", () => {
    for (const address of ["a@postscript.local", "a@x.test", "a@localhost", "a@mail.internal"]) {
      expect(isReservedAddress(address), address).toBe(true);
    }
    expect(isReservedAddress("a@postscriptmag.com")).toBe(false);
  });
});

describe("mailConfigProblems", () => {
  it("accepts the production setup", () => {
    expect(mailConfigProblems(production)).toEqual([]);
  });

  it("refuses the .local default in production", () => {
    const problems = mailConfigProblems({ ...production, mailFrom: "postscript <noreply@postscript.local>" });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("MAIL_FROM");
  });

  it("refuses a missing or malformed sender and a local SMTP host in production", () => {
    expect(mailConfigProblems({ ...production, mailFrom: undefined })[0]).toContain("tanımlı değil");
    expect(mailConfigProblems({ ...production, mailFrom: "postscript" })[0]).toContain("geçerli");
    expect(mailConfigProblems({ ...production, smtpHost: "localhost" })[0]).toContain("SMTP_HOST");
    expect(mailConfigProblems({ ...production, smtpPassword: undefined })[0]).toContain("SMTP_PASSWORD");
  });

  it("never quotes a value, only the variable's name", () => {
    const problems = mailConfigProblems({
      ...production,
      mailFrom: "x <gizli@postscript.local>",
      smtpPassword: "",
    });
    expect(problems.join(" ")).not.toContain("gizli");
  });

  it("lets development and tests use any sender", () => {
    expect(
      mailConfigProblems({ ...production, nodeEnv: "development", mailFrom: "a <a@postscript.local>" }),
    ).toEqual([]);
    expect(mailConfigProblems({ ...production, nodeEnv: "test", smtpHost: "localhost" })).toEqual([]);
  });
});
