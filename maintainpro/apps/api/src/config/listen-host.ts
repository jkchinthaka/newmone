/**
 * Production binds to loopback unless HOST is set explicitly: the API sits behind
 * Nginx + BFF on the same host, and X-Real-IP is only trusted from loopback peers.
 * Containers must set HOST=0.0.0.0.
 */
export function resolveListenHost(env: NodeJS.ProcessEnv): string {
  const explicit = env.HOST?.trim();
  if (explicit) return explicit;
  return env.NODE_ENV === "production" ? "127.0.0.1" : "0.0.0.0";
}
