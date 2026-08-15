#!/usr/bin/env bash
# Phase 19 — critical config inventory backup (non-secret templates only).
# Secrets must remain in the company vault; never copy .env with secrets into BACKUP_DIR.
set -euo pipefail
: "${BACKUP_DIR:?}"
: "${REPO_ROOT:=$(cd "$(dirname "$0")/../.." && pwd)}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${BACKUP_DIR}/critical_config_${STAMP}"
mkdir -p "${OUT_DIR}"

# Inventory of non-secret operational templates / compose / CI / settings skeletons.
cp -a "${REPO_ROOT}/.env.example" "${OUT_DIR}/" 2>/dev/null || true
cp -a "${REPO_ROOT}/docker-compose.yml" "${OUT_DIR}/" 2>/dev/null || true
cp -a "${REPO_ROOT}/docker-compose.override.yml" "${OUT_DIR}/" 2>/dev/null || true
mkdir -p "${OUT_DIR}/config/settings"
cp -a "${REPO_ROOT}/config/settings/"*.py "${OUT_DIR}/config/settings/" 2>/dev/null || true
mkdir -p "${OUT_DIR}/docs/operations"
cp -a "${REPO_ROOT}/docs/operations/"*.md "${OUT_DIR}/docs/operations/" 2>/dev/null || true

ARCHIVE="${BACKUP_DIR}/critical_config_${STAMP}.tar.gz"
tar -czf "${ARCHIVE}" -C "${BACKUP_DIR}" "critical_config_${STAMP}"
rm -rf "${OUT_DIR}"
sha256sum "${ARCHIVE}" > "${ARCHIVE}.sha256"
echo "Wrote ${ARCHIVE}"
echo "NOTE: vault-held secrets are NOT included — operator must back those up separately."
