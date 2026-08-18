#!/usr/bin/env bash
# Phase 19 — evidence private tree archive (encrypted storage target is operator-owned).
set -euo pipefail
: "${EVIDENCE_STORAGE_ROOT:?}"
: "${BACKUP_DIR:?}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${BACKUP_DIR}/evidence_${STAMP}.tar.gz"
mkdir -p "${BACKUP_DIR}"
tar -czf "${OUT}" -C "$(dirname "${EVIDENCE_STORAGE_ROOT}")" "$(basename "${EVIDENCE_STORAGE_ROOT}")"
sha256sum "${OUT}" > "${OUT}.sha256"
echo "Wrote ${OUT}"
