# Production User Provisioning

**Scope:** Named individual accounts only. No shared user accounts.
**Demo accounts:** Blocked outside approved local/test environments.
**Do not create real employee accounts without approved names/roles.**

## Principles

- Least privilege by default
- Organization-scoped RBAC
- Deny by default for sensitive workflows
- SoD review before production role combinations
- Every create / deactivate / role change audited

## Create user (proposed workflow)

1. Receive approved request: employee code, name, org, site, role(s).
2. Create user with unique employee code (login identifier).
3. Assign organization membership and site scope.
4. Assign role(s) per `role_assignments` approval.
5. Issue initial password via secure channel OR force reset on first login.
6. Verify login in staging before production (when staging exists).
7. Record evidence: who approved, who provisioned, when.

## Required attributes

| Attribute | Required | Notes |
| --- | --- | --- |
| Employee code | Yes | Unique login key |
| Full name | Yes | |
| Organization | Yes | |
| Site | Yes (if multi-site) | OWNER REQUIRED mapping |
| Role | Yes | recorder / supervisor / qa / admin as implemented |
| Active flag | Yes | |
| Email | Optional | Needed if SMTP reset used |

## Deactivate user

1. Disable `is_active` (do not delete historical audit actors).
2. Revoke sessions if supported.
3. Confirm queues no longer assign work to the user.
4. Audit deactivation reason and approver.

## Password reset

1. Prefer self-service or IT-assisted reset with temporary password + force change.
2. Never email passwords in clear text in tickets.
3. Never commit credentials.
4. Admin reset should enforce password change on next login when configured (`AUTH_PASSWORD_CHANGE_REQUIRED_ON_ADMIN_RESET`).

## Least privilege checklist

- [ ] Role matches job function only
- [ ] No unnecessary Admin
- [ ] No cross-org assignment
- [ ] SoD combinations reviewed (`SEGREGATION_OF_DUTIES_MATRIX.md`)
- [ ] Demo/test accounts absent from production

## SoD review gate

**BUSINESS APPROVAL REQUIRED** before allowing:

- Recorder + Supervisor on same person
- Supervisor + QA on same person
- Recorder + QA on same person
- Admin + business approval authority on same person

## Environment controls

| Environment | Demo accounts |
| --- | --- |
| local / test | Allowed only if documented and non-production labelled |
| staging | Prefer named UAT users; demo only if explicitly approved |
| production | **Forbidden** |

## Sign-off (blank)

| Role | Name | Date |
| --- | --- | --- |
| Business Owner | | |
| IT | | |
| Security Reviewer | | |
