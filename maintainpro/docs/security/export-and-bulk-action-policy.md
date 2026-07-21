# Export & Bulk Action Policy

Applies to CSV/PDF exports, report downloads, evidence archives, and bulk
update/delete/assignment/approval actions.

## Requirements

Every export or bulk action must:

1. Require an explicit permission (e.g. `reports.export`, `inventory.manage`,
   `work_orders.assign`) - viewing a screen must never imply the right to export
   or bulk-mutate all rows behind it.
2. Run under an active scope (tenant or platform); platform exports require
   `@PlatformScoped()` + `SUPER_ADMIN`.
3. Enforce a maximum record limit and use pagination or streaming.
4. Emit an audit event (actor id, tenant/platform scope, filters, row count,
   correlation id, result).
5. Validate tenant filters server-side; never accept a client-supplied tenant id
   for a tenant-scoped export.
6. Apply a field allowlist and sensitive-data redaction
   (`sensitive-data-redaction.util.ts`) before serialization.
7. Prevent CSV/formula injection: escape/neutralize leading `= + - @` and tab/CR
   in cell values.
8. Generate secure, non-guessable filenames and avoid returning insecure direct
   download URLs; downloads must re-check parent-record access.

## Webhooks and public endpoints

### Stripe / payment webhooks

`POST /billing/webhooks/stripe` (`@Public()` + `@PublicWebhook('stripe')`):

- verifies the `Stripe-Signature` HMAC against `STRIPE_WEBHOOK_SECRET` using
  `stripe.webhooks.constructEvent` over the raw request body;
- in live mode, a missing `STRIPE_WEBHOOK_SECRET` is a hard failure - the handler
  rejects the request rather than trusting an unsigned payload (the unsigned
  fallback is only reachable in non-production with
  `ALLOW_UNSIGNED_STRIPE_WEBHOOK=true` for local testing);
- processes only an allowlisted set of event types (`checkout.session.completed`,
  `customer.subscription.updated|deleted`, `invoice.paid|payment_failed`);
- resolves the tenant from the Stripe customer mapping, never from a client value;
- returns a safe response and does not leak internal errors.

Remaining hardening (tracked): explicit replay/timestamp window and a persisted
idempotency key on processed event ids.

### Other integration webhooks

Any future public webhook must carry `@PublicWebhook(provider)` and verify a
signature or shared secret, use replay protection and an idempotency key, map the
tenant from verified payload data (never a client-supplied id), and be rate
limited. The RBAC audit fails any `@Public()` route whose path contains `webhook`
that lacks `@PublicWebhook`.

### Health / readiness

`GET /health` is `@Public()` and must not expose environment variables, connection
strings, provider credentials, stack traces, internal hostnames, or detailed
dependency topology.

## Testing

`apps/api/test/rbac-authorization.spec.ts` proves the RBAC audit reports zero
unscoped routes, that scope decorators set the expected metadata, and that the
Stripe webhook rejects an unsigned payload in production live mode. Module-level
maker-checker and export-permission tests live in the per-module suites
(`inventory`, `work-order-parts-governance`, reports).
