#!/usr/bin/env bash
#
# Backup: a PostgreSQL dump plus a copy of the object storage (§11).
#
#   ./scripts/backup.sh [target-directory]
#
# Restore instructions are in README.md. Run it from the panel directory with
# DATABASE_URL and the S3_* variables set (or with a .env file present).
set -euo pipefail

TARGET="${1:-./backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${TARGET}/${STAMP}"

# Load .env if the variables are not already exported
if [ -f .env ] && [ -z "${DATABASE_URL:-}" ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

: "${DATABASE_URL:?DATABASE_URL is not set}"

mkdir -p "$OUT"

echo "==> PostgreSQL dump"
# Custom format: compressed and restorable table by table with pg_restore
pg_dump --format=custom --no-owner --no-privileges \
  --file="${OUT}/postscript.dump" "$DATABASE_URL"

echo "==> Object storage"
if command -v mc >/dev/null 2>&1; then
  ALIAS="postscript-backup"
  mc alias set "$ALIAS" "${S3_ENDPOINT:-http://localhost:9000}" \
    "${S3_ACCESS_KEY_ID:-postscript}" "${S3_SECRET_ACCESS_KEY:-postscript}" >/dev/null

  mc mirror --overwrite "${ALIAS}/${S3_BUCKET:-postscript}" "${OUT}/media"
  # Identity documents are personal data: kept separate so a restore can skip them
  mc mirror --overwrite "${ALIAS}/${S3_IDENTITY_BUCKET:-postscript-identity}" "${OUT}/identity"
else
  echo "    mc (MinIO client) not found — skipping object storage" >&2
fi

echo "==> Done: ${OUT}"
du -sh "$OUT"
