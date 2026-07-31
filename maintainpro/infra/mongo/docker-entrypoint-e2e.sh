#!/usr/bin/env bash
# Disposable E2E Mongo entrypoint: auth + replica set requires a keyFile (MongoDB 7+).
# Generates a volume-local keyFile once; never print its contents.
set -euo pipefail

KEYFILE="${MONGO_E2E_KEYFILE_PATH:-/data/db/e2e-mongo.keyfile}"

if [[ ! -f "$KEYFILE" ]]; then
  # openssl is available in the official mongo image
  openssl rand -base64 756 >"$KEYFILE"
fi
chmod 400 "$KEYFILE"
chown mongodb:mongodb "$KEYFILE" 2>/dev/null || chown 999:999 "$KEYFILE" 2>/dev/null || true

# Delegate to the official image entrypoint (handles MONGO_INITDB_* user bootstrap).
exec docker-entrypoint.sh mongod --replSet rs0 --bind_ip_all --keyFile "$KEYFILE"