// Vitest runs in plain Node, where the real `server-only` package throws on import.
// Tests exercise server modules directly, so it is aliased to this no-op.
export {};
