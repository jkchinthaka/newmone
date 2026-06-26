#!/bin/sh
set -e

if [ "${MAINTAINPRO_RUN_STARTUP_SEED}" = "true" ] && [ -n "${MAINTAINPRO_SEED_PASSWORD}" ]; then
  echo "Running idempotent startup seed (MAINTAINPRO_RUN_STARTUP_SEED=true)..."
  cd /seed-workspace
  npm run db:seed
  echo "Startup seed finished."
fi

cd /workspace/apps/api
exec "$@"
