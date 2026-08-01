# Purchase Receiving / GRN Contract

- Allowed only when workflowStatus=APPROVED and status ORDERED|PARTIALLY_RECEIVED.
- Atomic receipt + lines + sparePart increment + StockMovement IN + line receivedQuantity update.
- Rejected quantity never increases stock.
- Over-receipt blocked.
- Idempotency via PurchaseReceiptIdempotency when key provided.