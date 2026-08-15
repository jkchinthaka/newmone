# Technical Smoke — Local Demo Environment

```text
TECHNICAL SMOKE
```

Not formal human UAT. Not production evidence.

| Check | Result | Notes |
| --- | --- | --- |
| Date (UTC-ish local) | 2026-08-12 | |
| Application baseline | `c08ebec96b8551209bc2228866ceb2fb65031668` | UAT app SHA |
| Health live `http://127.0.0.1:8001/health/live/` | 200 | |
| Health ready `http://127.0.0.1:8001/health/ready/` | 200 | |
| Login page | 200 | |
| Root `/` | 200 | |
| Compose postgres | healthy | |
| Compose redis | healthy | |
| Web/celery via compose | not required for this smoke | host runserver in use |

Full recorder→supervisor→QA browser walkthrough remains in human UAT-07..09.
