# 10 Performance and reliability

My Jobs (`work-order-queues.service.ts`) still `take`s 500 rows, then filters, sorts, and counts in memory. Totals can disagree with the database once a technician has more than 500 assigned jobs. That defect is open. A dataset over 500 rows was not loaded.

Load and stress tests were not run. They are not allowed against shared infrastructure without approval.

Status updates now fail with 409 when the version is missing or stale, which is the concurrency control for that one path.
