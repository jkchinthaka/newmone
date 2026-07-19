import { SetMetadata } from "@nestjs/common";

/**
 * Self-service route: an authenticated route that only reads or mutates
 * resources belonging to the calling user (identified by `req.user.sub`) or the
 * user's own active tenant membership. Examples: a user's own notifications,
 * profile settings, push devices, personal AI conversations, or the list of
 * tenants the caller belongs to.
 *
 * This is an explicit authorization scope: it documents that the route
 * intentionally requires no elevated role/permission because the JWT-derived
 * caller identity is itself the object-level authorization boundary. The RBAC
 * static audit treats a self-service route as explicitly scoped (not a gap),
 * provided the handler derives its subject from the authenticated user and
 * never from a client-supplied user id.
 */
export const SELF_SERVICE_KEY = "selfService";
export const SelfService = () => SetMetadata(SELF_SERVICE_KEY, true);
