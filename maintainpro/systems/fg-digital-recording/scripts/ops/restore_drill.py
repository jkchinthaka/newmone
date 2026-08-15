"""Controlled non-production PostgreSQL restore drill (Phase 19).

Creates a marker row, dumps, restores into a scratch DB, verifies marker,
and writes evidence markdown.

Client tools:
- Host: psql / pg_dump / pg_restore on PATH, or
- Docker: set RESTORE_DRILL_DOCKER_SERVICE=postgres (compose service name).
"""

from __future__ import annotations

import hashlib
import os
import re
import subprocess  # nosec B404 — allowlisted pg client tools only
import sys
import tempfile
from datetime import UTC, datetime
from pathlib import Path

_IDENT_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_PG_TOOLS = frozenset({"psql", "pg_dump", "pg_restore"})


def _require_ident(value: str, *, name: str) -> str:
    if not _IDENT_RE.fullmatch(value):
        raise ValueError(f"{name} must be a PostgreSQL identifier, got {value!r}.")
    return value


def run(cmd: list[str], env: dict[str, str]) -> None:
    print("+", " ".join(_redact_cmd(cmd)))
    subprocess.check_call(cmd, env=env)  # nosec B603 — argv list, no shell, validated tools


def _redact_cmd(cmd: list[str]) -> list[str]:
    out: list[str] = []
    i = 0
    while i < len(cmd):
        part = cmd[i]
        if part == "-e" and i + 1 < len(cmd) and cmd[i + 1].startswith("PGPASSWORD="):
            out.extend(["-e", "PGPASSWORD=[REDACTED]"])
            i += 2
            continue
        if part.startswith("PGPASSWORD="):
            out.append("PGPASSWORD=[REDACTED]")
            i += 1
            continue
        out.append(part)
        i += 1
    return out


def _write_not_executed(evidence: Path, reason: str) -> None:
    evidence.write_text(
        (
            "# Restore Drill Evidence — Phase 19\n\n"
            f"**Result:** NOT EXECUTED in this environment ({reason}).\n\n"
            "Re-run `python scripts/ops/restore_drill.py` on a company-approved "
            "non-production operator workstation with PostgreSQL client tools, "
            "or with `RESTORE_DRILL_DOCKER_SERVICE=postgres` against local Compose.\n"
            "RPO/RTO remain **COMPANY DECISION REQUIRED**.\n"
        ),
        encoding="utf-8",
        newline="\n",
    )


def _docker_service() -> str:
    return (os.environ.get("RESTORE_DRILL_DOCKER_SERVICE") or "").strip()


def _pg_cmd(tool: str, *args: str, password: str = "") -> list[str]:
    """Build a pg client command for host tools or docker compose exec."""
    if tool not in _PG_TOOLS:
        raise ValueError(f"Unsupported client tool: {tool}")
    service = _docker_service()
    if service:
        # Inside the official postgres image, tools talk to localhost in-container.
        prefix = ["docker", "compose", "exec", "-T"]
        if password:
            prefix.extend(["-e", f"PGPASSWORD={password}"])
        prefix.append(service)
        return [*prefix, tool, *args]
    return [tool, *args]


def main() -> int:
    # When using docker compose exec into postgres, connect as localhost inside container.
    using_docker = bool(_docker_service())
    host = os.environ.get("POSTGRES_HOST", "127.0.0.1")
    port = os.environ.get("POSTGRES_PORT", "5432")
    if using_docker:
        host = os.environ.get("RESTORE_DRILL_PGHOST", "127.0.0.1")
        port = os.environ.get("RESTORE_DRILL_PGPORT", "5432")
    user = _require_ident(os.environ.get("POSTGRES_USER", "nelna_fg"), name="POSTGRES_USER")
    password = os.environ.get("POSTGRES_PASSWORD", "")
    source_db = _require_ident(
        os.environ.get("RESTORE_DRILL_SOURCE_DB", "nelna_fg"), name="RESTORE_DRILL_SOURCE_DB"
    )
    scratch_db = _require_ident(
        os.environ.get("RESTORE_DRILL_SCRATCH_DB", "nelna_fg_restore_drill"),
        name="RESTORE_DRILL_SCRATCH_DB",
    )
    env = os.environ.copy()
    if password:
        env["PGPASSWORD"] = password
        env["PGUSER"] = user

    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    evidence = Path("docs/operations/RESTORE_DRILL_EVIDENCE.md")
    with tempfile.TemporaryDirectory() as tmp:
        dump = Path(tmp) / f"drill_{stamp}.dump"
        common = ["-h", host, "-p", port, "-U", user]

        def pg(*args: str) -> list[str]:
            return _pg_cmd(*args, password=password)

        # Use validated identifiers in SQL (avoid psql :'var' — unreliable via
        # docker compose exec on Windows, where -v substitution can fail).
        run(
            pg(
                "psql",
                *common,
                "-d",
                "postgres",
                "-v",
                "ON_ERROR_STOP=1",
                "-c",
                (
                    # Identifiers validated by _require_ident (alphanumeric + underscore only).
                    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                    f"WHERE datname = '{scratch_db}' AND pid <> pg_backend_pid();"  # nosec B608
                ),
            ),
            env,
        )
        run(
            pg(
                "psql",
                *common,
                "-d",
                "postgres",
                "-v",
                "ON_ERROR_STOP=1",
                "-c",
                f'DROP DATABASE IF EXISTS "{scratch_db}";',  # nosec B608
            ),
            env,
        )
        run(
            pg(
                "psql",
                *common,
                "-d",
                "postgres",
                "-v",
                "ON_ERROR_STOP=1",
                "-c",
                f'CREATE DATABASE "{scratch_db}" TEMPLATE template0;',  # nosec B608
            ),
            env,
        )

        marker = f"phase19_restore_drill_{stamp}"
        run(
            pg(
                "psql",
                *common,
                "-d",
                source_db,
                "-v",
                "ON_ERROR_STOP=1",
                "-c",
                (
                    "CREATE TABLE IF NOT EXISTS ops_restore_drill_marker "
                    "(id text PRIMARY KEY, created_at timestamptz DEFAULT now());"
                ),
            ),
            env,
        )
        # marker is generated locally (phase19_restore_drill_<UTC stamp>).
        if not re.fullmatch(r"[A-Za-z0-9_]+", marker):
            raise ValueError(f"unsafe marker id: {marker!r}")
        run(
            pg(
                "psql",
                *common,
                "-d",
                source_db,
                "-v",
                "ON_ERROR_STOP=1",
                "-c",
                (
                    f"INSERT INTO ops_restore_drill_marker(id) VALUES ('{marker}') "  # nosec B608
                    "ON CONFLICT DO NOTHING;"
                ),
            ),
            env,
        )

        if using_docker:
            # Dump to stdout inside container, capture on host.
            dump_cmd = pg("pg_dump", *common, "-Fc", source_db)
            print("+", " ".join(_redact_cmd(dump_cmd)), ">", str(dump))
            with dump.open("wb") as dump_writer:
                subprocess.check_call(  # nosec B603 — argv list, no shell
                    dump_cmd, env=env, stdout=dump_writer
                )
            # Stream restore via stdin into scratch DB.
            restore_cmd = pg(
                "pg_restore",
                *common,
                "-d",
                scratch_db,
                "--clean",
                "--if-exists",
            )
            print("+", " ".join(_redact_cmd(restore_cmd)), "<", str(dump))
            with dump.open("rb") as dump_reader:
                subprocess.check_call(  # nosec B603 — argv list, no shell
                    restore_cmd, env=env, stdin=dump_reader
                )
        else:
            run(
                pg("pg_dump", *common, "-Fc", "-f", str(dump), source_db),
                env,
            )
            run(
                pg(
                    "pg_restore",
                    *common,
                    "-d",
                    scratch_db,
                    "--clean",
                    "--if-exists",
                    str(dump),
                ),
                env,
            )

        verify = subprocess.check_output(  # nosec B603 — argv list, no shell
            pg(
                "psql",
                *common,
                "-d",
                scratch_db,
                "-Atc",
                f"SELECT count(*) FROM ops_restore_drill_marker WHERE id = '{marker}';",  # nosec B608
            ),
            env=env,
            text=True,
        ).strip()
        ok = verify == "1"
        result = "PASS" if ok else "FAIL"
        digest = hashlib.sha256(dump.read_bytes()).hexdigest() if dump.exists() else "n/a"
        body = (
            f"# Restore Drill Evidence — Phase 19\n\n"
            f"**Executed at (UTC):** {stamp}\n"
            f"**Source DB:** `{source_db}` (local/non-production Compose)\n"
            f"**Scratch DB:** `{scratch_db}`\n"
            f"**Marker id:** `{marker}`\n"
            f"**Dump SHA-256:** `{digest}`\n"
            f"**Client mode:** `{'docker:' + _docker_service() if using_docker else 'host'}`\n"
            f"**Result:** {result} (verify count={verify})\n\n"
            "## Scope\n\n"
            "- PostgreSQL logical dump/restore only in this drill\n"
            "- Evidence object storage restore is a separate operator procedure\n"
            "- MongoDB SoR restore is N/A (PostgreSQL is primary SoR per ADR-002)\n\n"
            "## Notes\n\n"
            "Operator must retain dump checksums in the company-approved backup vault.\n"
            "RPO/RTO remain **COMPANY DECISION REQUIRED**.\n"
            "This PASS is technical evidence for Phase 19 — not production go-live approval.\n"
        )
        evidence.write_text(body, encoding="utf-8", newline="\n")
        print(body)
        # Destroy only the isolated scratch DB after successful verify.
        if ok:
            run(
                pg(
                    "psql",
                    *common,
                    "-d",
                    "postgres",
                    "-v",
                    "ON_ERROR_STOP=1",
                    "-c",
                    (
                        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                        f"WHERE datname = '{scratch_db}' AND pid <> pg_backend_pid();"  # nosec B608
                    ),
                ),
                env,
            )
            run(
                pg(
                    "psql",
                    *common,
                    "-d",
                    "postgres",
                    "-v",
                    "ON_ERROR_STOP=1",
                    "-c",
                    f'DROP DATABASE IF EXISTS "{scratch_db}";',  # nosec B608
                ),
                env,
            )
            print(f"Dropped isolated scratch database {scratch_db}.")
        return 0 if ok else 1


if __name__ == "__main__":
    evidence_path = Path("docs/operations/RESTORE_DRILL_EVIDENCE.md")
    try:
        raise SystemExit(main())
    except FileNotFoundError as exc:
        print("psql/pg_dump not available:", exc, file=sys.stderr)
        _write_not_executed(evidence_path, "psql/pg_dump unavailable or blocked")
        raise SystemExit(2) from exc
    except subprocess.CalledProcessError as exc:
        print("restore drill command failed:", exc, file=sys.stderr)
        _write_not_executed(evidence_path, "psql/pg_dump/pg_restore command failed")
        raise SystemExit(2) from exc
