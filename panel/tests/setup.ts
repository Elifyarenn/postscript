/**
 * Vitest global setup: gives every test a predictable environment so that
 * importing a server module does not require a real deployment configuration.
 */
// NODE_ENV is typed as read-only, so it is assigned through the env object
Object.assign(process.env, { NODE_ENV: "test" });
process.env.APP_URL ??= "http://localhost:3001";
process.env.SESSION_SECRET ??= "test-session-secret-0123456789abcdef";
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
process.env.MAIL_FROM ??= "postscript <noreply@postscript.test>";
