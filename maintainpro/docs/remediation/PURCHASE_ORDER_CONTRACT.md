# Purchase Order Contract

- Create requires non-empty lines, active non-blacklisted supplier (admin emergency override + reason).
- partId required and tenant-active; optional partRequestId must be APPROVED with outstanding qty.
- totalAmount optional from client; mismatch > 0.009 => 400.
- poNumber unique per tenant (@@unique([tenantId, poNumber])); production duplicate audit is operator-owned before push.
- createdById recorded for maker-checker.