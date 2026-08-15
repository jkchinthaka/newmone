# Go-live checklist

None of these boxes may be ticked without written evidence. Software must not invent ticks.

## Mandatory decision gates

- [ ] Formal UAT completed
- [ ] Critical defects closed
- [ ] High defects closed/accepted
- [ ] Forms approved
- [ ] Master data approved
- [ ] Roles approved
- [ ] SoD approved
- [ ] Physical printer tested
- [ ] Real device tested
- [ ] Sinhala tested
- [ ] Security review signed
- [ ] Staging validated
- [ ] Backup verified
- [ ] Restore verified in staging
- [ ] TLS configured
- [ ] SMTP configured
- [ ] Monitoring configured
- [ ] Production secrets configured
- [ ] Rollback tested
- [ ] Support owner assigned
- [ ] Business Owner approval
- [ ] IT approval
- [ ] QA approval
- [ ] Production release SHA approved

## Technical package status (non-substituting for gates)

| Item | Technical status |
| --- | --- |
| Application UAT baseline | `c08ebec96b8551209bc2228866ceb2fb65031668` |
| Human UAT cases recorded PASS | UAT-01, UAT-02, UAT-03 only |
| Remaining UAT cases | AWAITING HUMAN UAT |
| MaintainPro nav code | BLOCKED — repo path required |
| Bileeta live | BLOCKED — contract/credentials |
| Staging deployed | NOT CLAIMED |
| Production deployed | NOT CLAIMED |

Until every mandatory gate is evidenced, the system is **not authorized for go-live**.

Related: `docs/uat/UAT_SIGNOFF.md`, `docs/handover/PRODUCTION_SIGNOFF.md`, `docs/handover/BUSINESS_EVIDENCE_REGISTER.md`
