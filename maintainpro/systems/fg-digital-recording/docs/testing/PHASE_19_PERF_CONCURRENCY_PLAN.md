# Phase 19 — Performance / concurrency / E2E plan

## Synthetic performance

```bash
python scripts/perf/synthetic_workload.py --base-url http://127.0.0.1:8000 --workers 8 --requests 40
```

Covers health latency smoke only. Full login/queue/recording/submit/Supervisor/QA/traceability/report load tests require staging data and remain operator-owned.

## Concurrency pytest

`tests/concurrency/test_phase19_concurrency.py` — duplicate integration identity stability, CSV sanitize parallelism, poison auth failure, and service-contract checks for submit/correction/supervisor/QA.

## E2E smoke

`tests/e2e/test_phase19_critical_workflow_smoke.py` — login → landing → health; logout session end; anonymous denial for recording/review/QA queues and correction start URL.

Correction-path deep browser E2E remains covered by domain Phase 08/09 service tests; Playwright pack is optional when approved for CI images.

## CI / scans

Supported in `.github/workflows/ci.yml`: ruff, mypy, bandit, pip-audit, npm audit (advisory), pytest+coverage, Docker image build, Trivy FS scan (advisory / soft-fail until baseline approved).
