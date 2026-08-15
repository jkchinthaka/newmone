#!/usr/bin/env python3
"""Safely reset local development data — never for production."""

from __future__ import annotations

import argparse
import os
import sys


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Refuse-by-default local reset helper. Does not delete Docker volumes "
            "or files outside the project. Requires --confirm-local-reset."
        )
    )
    parser.add_argument(
        "--confirm-local-reset",
        action="store_true",
        help="Explicit confirmation that local data may be reset",
    )
    args = parser.parse_args()

    settings_module = os.environ.get("DJANGO_SETTINGS_MODULE", "")
    env_label = os.environ.get("ENVIRONMENT_LABEL", "").lower()

    if "production" in settings_module or env_label == "production":
        print("Refusing to run under production settings.", file=sys.stderr)
        return 2

    if (
        settings_module
        and "local" not in settings_module
        and env_label not in {"local", "test", ""}
    ):
        print(
            f"Refusing unknown environment (settings={settings_module!r}, label={env_label!r}).",
            file=sys.stderr,
        )
        return 2

    if not args.confirm_local_reset:
        print(
            "This script can flush the local Django database only.\n"
            "It will NOT delete Docker volumes, media outside the project, or secrets.\n"
            "Re-run with --confirm-local-reset after reviewing impact.\n"
            "Docker volume reset (manual): docker compose down -v",
            file=sys.stderr,
        )
        return 1

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")
    import django

    django.setup()
    from django.conf import settings
    from django.core.management import call_command

    if not settings.DEBUG and getattr(settings, "ENVIRONMENT_LABEL", "") != "local":
        print("Refusing: settings are not a confirmed local debug environment.", file=sys.stderr)
        return 2

    print("Flushing local database tables (Django flush)...")
    call_command("flush", interactive=False, verbosity=1)
    print("Local Django database flush complete. Docker volumes were not touched.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
