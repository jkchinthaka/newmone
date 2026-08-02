# Production Operator Checklist

All real production actions: **OPERATOR_ONLY** / **REQUIRES_EXPLICIT_DEPLOYMENT_APPROVAL**.

## BEFORE CUTOVER

- [ ] Approved release SHA + image digest
- [ ] Backup freshness + restore-test evidence (production, not E2E)
- [ ] Credential rotation status
- [ ] Production `.env` validated (operator host)
- [ ] Port owner selected
- [ ] HTTPS certificate ready
- [ ] Domain/DNS/firewall approved
- [ ] Role/permission dry-run reviewed
- [ ] Monitoring/alert channels ready
- [ ] Support owner + rollback + communications ready

## CUTOVER

- [ ] Change freeze → backup → image verify → migration → startup → ready → login → business smoke → monitoring → stakeholder comms

## AFTER CUTOVER

- [ ] Hypercare → incidents → reconciliation → backup verify → sign-off → rollback window → handover