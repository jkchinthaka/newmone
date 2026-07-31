import { ensureE2eEnvironmentLoaded } from "./load-e2e-process-env";

function ensureLoaded() {
  ensureE2eEnvironmentLoaded({ requireSeedPassword: true });
}

export function e2eRunId() {
  ensureLoaded();
  const runId = (process.env.E2E_RUN_ID || "").trim();
  if (!runId) throw new Error("E2E_RUN_ID required");
  return runId;
}

export function e2ePassword() {
  ensureLoaded();
  const password = (process.env.E2E_SEED_PASSWORD || "").trim();
  if (!password) {
    throw new Error(
      "Required disposable E2E credential E2E_SEED_PASSWORD is unavailable."
    );
  }
  return password;
}

export function e2eEmail(local: string) {
  ensureLoaded();
  const domain = (process.env.E2E_SEED_EMAIL_DOMAIN || "e2e.maintainpro.test").trim();
  return `${local}.${e2eRunId()}@${domain}`.toLowerCase();
}

export function assertLoopbackBaseURL(baseURL: string) {
  const host = new URL(baseURL).hostname.toLowerCase();
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(`Refusing non-loopback baseURL host ${host}`);
  }
}