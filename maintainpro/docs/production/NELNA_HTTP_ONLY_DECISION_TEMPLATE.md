# Nelna HTTP-Only Deployment Approval and Risk Acceptance

**Status:** `HTTP_ONLY_APPROVAL_PENDING`  
**Do not fabricate approval or signature.**

## Approved deployment scope (technical)

| Field | Value |
| --- | --- |
| Environment | Nelna Windows Server 2022 — MaintainPro Compose project `maintainpro` |
| Public URL | `http://135.171.163.249` |
| Transport | HTTP only |
| Application contract | `ALLOW_INSECURE_HTTP=true`, `COOKIE_SECURE=false` |
| Public edge | Nginx owns port 80 |
| HTTPS mandatory for this scope | No (company requirement for current deployment) |

## Risk acknowledgement (must be accepted by approver)

I understand and accept that:

1. HTTP traffic is **not encrypted**.
2. Credentials, session cookies, and application data may be observable on the network path.
3. This is an explicit company requirement for the current deployment scope.
4. Future HTTPS enablement remains a planned security improvement when authorized.
5. This approval does **not** by itself authorize Phase 8 cutover without the remaining gates in `PHASE8_AUTHORIZATION_CHECKLIST.md`.

## Approver fields (human completion required)

| Field | Value |
| --- | --- |
| Approving manager name | |
| Role / title | |
| Approval date | |
| Deployment environment | Nelna / MaintainPro |
| Approved public URL | `http://135.171.163.249` |
| Explicit HTTP-only approval | ☐ Yes |
| Acknowledgement: HTTP is not encrypted | ☐ Yes |
| Approved duration | ☐ Temporary until ________ · ☐ Permanent until reviewed |
| Future HTTPS review date (if applicable) | |
| Signature / reference | |
| Change / ticket reference | |

Until this template is completed with real human evidence, status remains:

**HTTP_ONLY_APPROVAL_PENDING**