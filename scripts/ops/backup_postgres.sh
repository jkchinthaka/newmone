#!/usr/bin/env bash
# Phase 19 — PostgreSQL logical backup helper (company-approved operator only).
# Secrets must come from environment/vault. Do not embed credentials.
set -euo pipefail
: "${POSTGRES_HOST:?}"
: "${POSTGRES_PORT:?}"
: "${POSTGRES_DB:?}"
: "${POSTGRES_USER:?}"
: "${BACKUP_DIR:?}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${BACKUP_DIR}/nelna_fg_${POSTGRES_DB}_${STAMP}.dump"
mkdir -p "${BACKUP_DIR}"
pg_dump -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -Fc -f "${OUT}" "${POSTGRES_DB}"
sha256sum "${OUT}" > "${OUT}.sha256"
echo "Wrote ${OUT}"
