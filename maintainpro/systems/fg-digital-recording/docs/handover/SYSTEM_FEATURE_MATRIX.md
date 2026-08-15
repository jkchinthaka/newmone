# System feature matrix

Labels: IMPLEMENTED = code exists. VALIDATED = tests exist on the feature branch. BUSINESS APPROVED = owner writing exists. UAT = human UAT. PROD = go-live.

| Capability | Implemented | Tests | Business approved | UAT | Prod |
| --- | --- | --- | --- | --- | --- |
| Login / RBAC deny-by-default | Yes | Yes | No | Open | No |
| Daily Cleaning CL/24 | Yes | Yes | No | Open | No |
| Cold room CL/39 | Yes | Seed + daily open | No | Open | No |
| Truck CL/30 | Yes | Seed | No | Open | No |
| Dispatch CL/18 ten samples | Yes | Yes | No | Open | No |
| Daily Records queues | Yes | Yes | n/a | Open | No |
| Print with saved answers | Yes | Yes | n/a | Open | No |
| Monthly print pack | Yes | Partial | n/a | Open | No |
| History + CSV | Yes | Yes | n/a | Open | No |
| XLSX export | No (CSV only; not renamed) | n/a | n/a | n/a | No |
| Supervisor approve/return | Yes | Yes | No | Open | No |
| QA RELEASE/HOLD/REJECT | Yes | Yes | No | Open | No |
| NCR workspace | Yes | Yes | No | Open | No |
| RCA workspace | Yes | Yes | No | Open | No |
| CAPA + effectiveness UI | Yes | Yes | No | Open | No |
| Laboratory queue | Yes | Yes | No | Open | No |
| HACCP viewer | Yes | Yes | No | Open | No |
| Dispatch quality workspace | Yes | Yes | No | Open | No |
| Complaints workspace | Yes | Yes | No | Open | No |
| Quarantine workspace | Yes | Yes | No | Open | No |
| Quality trend counts | Yes | Yes | n/a | Open | No |
| Measurement series stats | Yes | Partial | n/a | Open | No |
| COPQ priced model | No — costs not invented | n/a | Required | Open | No |
| Full OEE | No — Quality-only counts possible | n/a | Required | Open | No |
| SPC with company limits | No invented limits | n/a | Required | Open | No |
| Offline writes | No — ONLINE-ONLY | n/a | n/a | Open | No |
| Live Bileeta | Boundary only | Contract tests exist | No | Open | No |
| MongoDB SoR | Do not migrate | POC only | n/a | n/a | No |
