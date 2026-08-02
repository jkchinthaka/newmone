# Production Network Exposure Matrix

| Service | Container port | Host port | Bind address | Public? |
| --- | ---: | ---: | --- | ---: |
| nginx (OPTION A undecided) | 80 | 80 | host (pending decision) | edge only when selected |
| api | 3000 | none | docker network | no |
| web | 3001 | none | docker network | no |
| mongo | 27017 | 27018 | 127.0.0.1 | no |
| redis | 6379 | none | docker network | no |
| minio | 9000/9001 | 9000/9001 | 127.0.0.1 | no |
| metrics/readiness detailed | 3000 | none | protected auth | no |

Requirements: no 0.0.0.0 database/admin ports; only selected edge proxy public.