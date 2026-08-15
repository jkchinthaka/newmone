#!/usr/bin/env bash
set -euo pipefail

# Optional local-development entrypoint.
# Waits for PostgreSQL, then executes the container command.
# Does not create superusers, load fixtures, or run destructive resets.

if [[ "${WAIT_FOR_POSTGRES:-1}" == "1" ]]; then
  python /app/scripts/wait_for_postgres.py --timeout "${POSTGRES_WAIT_TIMEOUT:-60}"
fi

exec "$@"