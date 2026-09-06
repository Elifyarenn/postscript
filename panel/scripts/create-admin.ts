/**
 * Creates or promotes an administrator from the command line.
 *
 * This is the only way an admin comes into existence; the interface cannot
 * create one (§3 rule 6). Subsequent admins are appointed by an existing admin
 * from the panel.
 *
 * Usage:
 *   pnpm create-admin -- --email admin@example.com --name "Ad Soyad" --password "…"
 *   pnpm create-admin -- --email existing@example.com --promote
 */
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { hashPassword, checkPasswordPolicy } from "@/lib/password";
import { recordRoleChange } from "@/lib/audit";
import { runScript } from "./_bootstrap";

/** Minimal `--key value` / `--flag` parser; no dependency needed for four options. */
function parseArgs(argv: string[]): Record<string, string | true> {
  const parsed: Record<string, string | true> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[key] = next;
      index += 1;
    } else {
      parsed[key] = true;
    }
  }
  return parsed;
}

runScript(async () => {
  const args = parseArgs(process.argv.slice(2));
  const email = typeof args.email === "string" ? args.email.toLowerCase().trim() : "";

  if (!email) {
    console.error(
      'Usage: pnpm create-admin -- --email <address> [--name "Ad Soyad"] [--password <password>] [--promote]',
    );
    process.exit(1);
  }

  const existing = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1);

  const found = existing[0];

  if (found) {
    if (found.role === "admin") {
      console.log(`${email} is already an administrator.`);
      return;
    }
    if (args.promote !== true) {
      console.error(
        `${email} exists with role "${found.role}". Pass --promote to raise it to admin.`,
      );
      process.exit(1);
    }

    await db
      .update(users)
      .set({ role: "admin", updatedAt: new Date() })
      .where(eq(users.id, found.id));

    // A role never changes without its record, not even from the CLI
    await recordRoleChange({
      userId: found.id,
      oldRole: found.role,
      newRole: "admin",
      changedBy: null,
      note: "create-admin CLI",
    });

    console.log(`Promoted ${email} to admin.`);
    return;
  }

  const password = typeof args.password === "string" ? args.password : "";
  if (!password) {
    console.error("A new account needs --password.");
    process.exit(1);
  }

  const policy = checkPasswordPolicy(password);
  if (!policy.ok) {
    console.error(policy.reason);
    process.exit(1);
  }

  const now = new Date();
  const [created] = await db
    .insert(users)
    .values({
      email,
      passwordHash: await hashPassword(password),
      displayName: typeof args.name === "string" ? args.name : "Administrator",
      role: "admin",
      // Created out of band, so the address counts as verified and consent recorded
      emailVerifiedAt: now,
      kvkkConsentAt: now,
      kvkkConsentVersion: 1,
    })
    .returning();

  await recordRoleChange({
    userId: created!.id,
    oldRole: "user",
    newRole: "admin",
    changedBy: null,
    note: "create-admin CLI (first admin)",
  });

  console.log(`Created admin ${email}.`);
  console.log("Two factor authentication is mandatory and will be set up at first login.");
});
