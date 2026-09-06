// The real `server-only` package throws when it is imported outside a React
// Server Component graph. Command line scripts legitimately import the same
// service modules, so they resolve this stub instead (see scripts/tsconfig.json).
export {};
