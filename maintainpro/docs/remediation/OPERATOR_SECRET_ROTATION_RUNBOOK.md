# Operator Secret Rotation Runbook

**Classification:** Operator-only · Confidential process · No credentials in this document  
**Related risk:** Compromised MongoDB root credential (treat old value as permanently compromised)  
**Related TODO:** TODO-P1-002 / P1-OPS-001 — status remains **OPERATOR_ACTION_REQUIRED** until evidence is filed

## 1. Incident description

A MongoDB **root** credential was previously exposed outside the secure environment.

- The old credential must be treated as **compromised forever**.
- Do **not** reuse the old password.
- Do **not** paste any password into chat, email, tickets, Git, screenshots, or CI logs.
- This runbook uses placeholders only: `<NEW_ROOT_PASSWORD>`, `<AUTHORIZED_OPERATOR>`, `<BACKUP_REFERENCE>`.

## 2. Preconditions

Before starting:

| # | Check | Evidence |
| --- | --- | --- |
| 1 | Approved maintenance window | Change ticket ID |
| 2 | Operator is authorized | `<AUTHORIZED_OPERATOR>` named |
| 3 | Confirmed MongoDB backup exists and is restorable | `<BACKUP_REFERENCE>` |
| 4 | Docker engine is available on the host | `docker info` (no secrets) |
| 5 | Application health currently OK | `GET /api/health` → 200 |
| 6 | Password manager / vault available | Vault entry prepared (empty until set) |
| 7 | Real `.env` path known on server | Path recorded privately — not in Git |

**Do not** run `docker compose down -v`, volume deletes, or database drops.

## 3. Safe password generation

On an operator workstation (not shared chat):

```powershell
# Generates a random password into the clipboard (Windows). Clear clipboard after vault storage.
Add-Type -AssemblyName System.Web
$pwd = [System.Web.Security.Membership]::GeneratePassword(40, 8)
Set-Clipboard -Value $pwd
# Immediately paste into the vault as <NEW_ROOT_PASSWORD>, then:
$pwd = $null
Set-Clipboard -Value ""
```

Rules:

- Prefer vault-native generators when available.
- Avoid `echo` / `Write-Host` of the password.
- Avoid shell history: prefer interactive vault paste into Mongo tools.
- Never commit or screenshot the value.

## 4. MongoDB root password rotation (placeholder procedure)

1. Confirm backup `<BACKUP_REFERENCE>`.
2. Retrieve current production Compose project name (no secrets in notes).
3. Open a shell **into** the running `mongo` container (example — adjust names to your deployment):

```powershell
docker compose -f docker-compose.yml -f docker-compose.production.yml exec -it mongo mongosh -u "<CURRENT_ROOT_USERNAME>" --authenticationDatabase admin
```

4. When prompted, enter the **current** root password from the vault (not written here).
5. Inside `mongosh`, rotate using the vault value for `<NEW_ROOT_PASSWORD>` (type/paste once; do not log):

```javascript
use admin
db.changeUserPassword("<CURRENT_ROOT_USERNAME>", passwordPrompt())
```

6. Exit mongosh.
7. Update the server `.env` entries (see section 5):
   - `MONGO_INITDB_ROOT_PASSWORD`
   - Any derived connection strings that embed the root password (prefer **app user** strings for NestJS — root should not be in app URLs).
8. Recreate **only** containers that must reload env (**without** deleting volumes):

```powershell
# Example — recreate mongo + api so new env is loaded. NEVER add -v.
docker compose --env-file .env -f docker-compose.yml -f docker-compose.production.yml up -d --no-deps --force-recreate mongo
docker compose --env-file .env -f docker-compose.yml -f docker-compose.production.yml up -d --no-deps --force-recreate api
```

9. Verify (section 7).

## 5. Safe `.env` update procedure

1. Open the production `.env` on the server with a secure editor.
2. Replace `MONGO_INITDB_ROOT_PASSWORD` with `<NEW_ROOT_PASSWORD>` from the vault.
3. Confirm NestJS `PRIMARY_DATABASE_URL` / `DATABASE_URL` still use the **application** user, not root.
4. Save the file (permissions restricted to the service account).
5. Do **not** copy `.env` into the repository, tickets, or backups that are world-readable.
6. Do **not** run commands that print the file (avoid `type .env`, `Get-Content .env` in shared logs).

## 6. Container recreation constraints

Allowed:

- `docker compose ... up -d --force-recreate <service>`
- `docker compose ... restart <service>`

Forbidden:

- `docker compose down -v`
- `docker volume rm`
- `docker system prune` (during this change window)
- Any command that drops databases or deletes `/data/db`

## 7. Post-rotation verification

| Check | Expected |
| --- | --- |
| Root login with `<NEW_ROOT_PASSWORD>` | Success |
| Root login with old password | **Failure** |
| Application Mongo user login | Success |
| `GET /api/health` | HTTP 200 |
| Spot-check collection counts / sample non-PII metadata | Data still present |
| `docker compose ps` | mongo, api, web, nginx healthy |

Record results **without** passwords.

## 8. Rollback considerations

- If the new password was set in MongoDB but `.env` was not updated, API auth to Mongo may fail — fix `.env` from vault and recreate `api`.
- If MongoDB password change failed, retain previous vault entry until success is confirmed.
- Restore from `<BACKUP_REFERENCE>` only if data integrity is impacted (separate DR procedure).
- Never roll back by re-using the **exposed** old password as the long-term secret.

## 9. Evidence checklist (no passwords)

| Field | Value |
| --- | --- |
| Timestamp (UTC) | |
| Operator | `<AUTHORIZED_OPERATOR>` |
| Change ticket | |
| Backup reference | `<BACKUP_REFERENCE>` |
| Old credential invalidated | Yes / No |
| New root auth verified | Yes / No |
| App user auth verified | Yes / No |
| API health 200 | Yes / No |
| Data present spot-check | Yes / No |
| Secret absent from Git / images / tickets | Yes / No |

Attach this completed table to the incident ticket. **Do not** attach `.env` or password material.

## 10. Follow-up

1. Rotate any credential stored beside the exposed secret (shared docs, password managers, secondary admins).
2. Review MongoDB and host access logs for suspicious use of the old credential.
3. Confirm Docker images rebuilt after `.dockerignore` hardening do not contain `.env`.
4. Confirm `npm run validate:secret-safety` remains green on the release branch.
5. Update remediation TODO from **OPERATOR_ACTION_REQUIRED** to **VALIDATED** only when this evidence checklist is complete.
6. Schedule TLS / network review if the exposure channel suggests broader compromise.