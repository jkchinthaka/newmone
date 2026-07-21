import { SetMetadata } from "@nestjs/common";

/**
 * Marks a `@Public()` route as an integration webhook that authenticates the
 * caller by cryptographic provider signature (or shared secret) instead of a
 * user session. The named provider documents which signature scheme the handler
 * must verify (e.g. "stripe" -> Stripe-Signature HMAC).
 *
 * The RBAC static audit requires every public webhook route to carry this
 * marker so that unauthenticated transport endpoints are explicitly reviewed
 * and cannot silently accept unsigned, spoofable payloads.
 */
export const PUBLIC_WEBHOOK_KEY = "publicWebhook";
export const PublicWebhook = (provider: string) => SetMetadata(PUBLIC_WEBHOOK_KEY, provider);
