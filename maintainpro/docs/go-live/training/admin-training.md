# Admin Training — MaintainPro

**UAT phase:** UAT-023  
**Role:** `ADMIN` (and `SUPER_ADMIN` where noted)  
**Duration:** 4 hours classroom + 2 hours hands-on  
**Last updated:** 2026-07-02

---

## 1. Role overview

Platform administrators provision users, manage tenants and invitations, monitor system health, execute controlled overrides, and support pilot cutover. Admins enable others to follow **No system record = No official company action** — admins must not encourage off-system workarounds.

---

## 2. What you CAN do

| Action | Route / area |
|--------|--------------|
| Admin console — users, tenants, invitations | `/admin` |
| User CRUD and role assignment | Admin → Users |
| Roles & permissions management | Admin → Roles |
| System health & deployment readiness | `/system-health` |
| Settings (organization) | `/settings` |
| Full work order governance | `/work-orders` |
| Audit log view and export | `/audit` |
| Fraud & management reports | `/reports/*` |
| Notification template view | Notifications admin |
| Controlled overrides (with reason) | Per module override dialogs |
| Deployment-readiness API review | System health page |

**SUPER_ADMIN only:** `system.configure`, billing checkout, notification UAT test endpoints.

---

## 3. What you CANNOT do

| Blocked action | Why |
|----------------|-----|
| Routine technician work on behalf of users | Role integrity — train users |
| Silent override without reason | Audit / fraud policy |
| Share passwords or JWT tokens | Security policy |
| Commit secrets to git or docs | Compliance |
| Delete audit logs | Immutable trail |
| Disable fraud control in production without CR | Change request required |
| Assign SUPER_ADMIN to floor staff | Least privilege |

---

## 4. Daily workflow (pilot support)

### User support

1. Monitor support queue for access issues.
2. Verify user role, tenant (`X-Tenant-Id`), and active status.
3. Reset access via invitation / password flow — never share credentials in chat.

[Screenshot: Admin user list and role assignment]

### Health monitoring

4. Check **System Health** each morning ([live-monitoring-plan.md](../live-monitoring-plan.md)).
5. Review deployment-readiness flags before endorsing deploys.

[Screenshot: System health dashboard]

### Override governance

6. Process override requests only with manager approval ticket.
7. Ensure reason entered — appears in fraud report.

### Change coordination

8. Route feature requests via [change-request-process.md](../developer-protection/change-request-process.md).
9. Log P0/P1 incidents per incident SOP.

---

## 5. Common mistakes

| Mistake | Correct approach |
|---------|------------------|
| Giving everyone ADMIN | Least privilege per [permission-matrix.md](../permission-matrix.md) |
| Fixing data by direct DB edit | Use API/admin tools + change ticket |
| Skipping training sign-off for new users | Training before prod access |
| Testing in production during business hours | Use staging or maintenance window |
| Leaving staging credentials in production env | Secret manager review at cutover |

---

## 6. Escalation

| Situation | Escalate to |
|-----------|-------------|
| Database unavailable | DevOps P0 |
| Suspected breach | Security + DevOps P0 |
| RBAC bug (wrong 403) | Backend lead P1 |
| Cutover failure | Release manager — [cutover-plan.md](../cutover-plan.md) |
| Legal data request | Compliance + DBA |

---

## 7. Support contacts

| Level | Contact |
|-------|---------|
| DevOps on-call | Secret manager |
| Backend engineering | **TBD** |
| Security | **TBD** |

---

## 8. Related SOPs & docs

- [admin-override-sop.md](../sop/admin-override-sop.md)
- [developer-protection/deployment-checklist.md](../developer-protection/deployment-checklist.md)
- [developer-protection/incident-response-sop.md](../developer-protection/incident-response-sop.md)
- [permission-matrix.md](../permission-matrix.md)

---

## 9. Training sign-off

| Field | Value |
|-------|-------|
| Trainee name | |
| Employee ID | |
| Training date | |
| Trainer | |
| Provisioned test user exercise | ☐ Yes |
| System health review exercise | ☐ Yes |

| Trainee signature | Date |
|-------------------|------|
| | |

| Trainer signature | Date |
|-------------------|------|
| | |

**Policy acknowledged:** I will protect credentials, enforce RBAC, and document all administrative overrides.
