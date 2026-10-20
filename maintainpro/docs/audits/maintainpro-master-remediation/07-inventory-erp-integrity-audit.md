# 07 Inventory and ERP integrity

`verified-stock-availability.ts` computes available quantity from the ERP snapshot minus reservations and unreconciled pending consumption. Pending outbox status is not treated as ERP confirmation. Missing provenance fails closed.

`work-order-erp-stock-boundary.spec.ts` passed in this session.

`verified-stock.integration.spec.ts` was not executed. It requires `DISPOSABLE_SQLSERVER_URL` pointing at `maintainpro_e2e_*`.

No live Bileeta call was made. Local intent is not a confirmed deduction. Distributed atomicity with Bileeta is not claimed.
