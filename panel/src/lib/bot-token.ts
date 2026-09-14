/**
 * The form field the Turnstile widget writes its token into (D-111). Kept apart
 * from `turnstile.ts`, which is server-only, so the client widget can share it.
 */
export const BOT_TOKEN_FIELD = "botToken";
