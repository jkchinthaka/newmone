# Secrets findings

Date: 2026-08-18

## Current tree

`npm run validate:secret-safety` on this branch: **PASS** (12 structural checks).

No `.env`, private keys, credential backups, production dumps, or Excel exports are tracked.

Tracked placeholders only:

- `maintainpro/.env.example`
- `maintainpro/apps/api/.env.example`
- `maintainpro/systems/fg-digital-recording/.env.example` (local-only labels, not production credentials)
- `maintainpro/.env.compose-ci` (CI fixture; production compose does not load it)

Unpushed commits were name-scanned: no `.pem` / `.key` / dumps / real `.env` files.

## Historical Git exposure

An old Mongo credential remains in Git history. Treat it as compromised.

- Do not print, test, reuse, or rewrite history.
- Credential owner must rotate/revoke the affected credential.

`HISTORICAL_SECRET_ROTATION=PENDING_EXTERNAL_ACTION`

## Production

This slice did not print environment files or rotate secrets.
`PRODUCTION_CHANGED=NO`.
