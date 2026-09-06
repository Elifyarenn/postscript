/**
 * Environment configuration.
 *
 * Every secret enters the application here and nowhere else, so a missing or
 * malformed variable fails loudly at boot instead of at the first request.
 */
import "server-only";
import { z } from "zod";

const booleanish = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3001"),

  DATABASE_URL: z.string().min(1),

  SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be at least 16 characters"),
  SESSION_MAX_AGE_DAYS: z.coerce.number().int().positive().default(30),
  SESSION_IDLE_DAYS: z.coerce.number().int().positive().default(7),

  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: booleanish,
  MAIL_FROM: z.string().default("postscript <noreply@postscript.local>"),

  S3_ENDPOINT: z.string().default("http://localhost:9000"),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY_ID: z.string().default("postscript"),
  S3_SECRET_ACCESS_KEY: z.string().default("postscript"),
  S3_BUCKET: z.string().default("postscript"),
  S3_IDENTITY_BUCKET: z.string().default("postscript-identity"),
  S3_FORCE_PATH_STYLE: booleanish,

  REVALIDATE_WEBHOOK_URL: z.string().optional(),
  REVALIDATE_WEBHOOK_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/**
 * Parsed environment. Lazy so that importing this module in a test file does
 * not require a full production environment to be present.
 */
export function env(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}

/** Only for tests: forget the memoised value after changing process.env. */
export function resetEnvCache(): void {
  cached = null;
}

export function isProduction(): boolean {
  return env().NODE_ENV === "production";
}
