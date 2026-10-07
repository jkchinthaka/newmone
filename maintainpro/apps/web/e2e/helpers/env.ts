import fs from "node:fs";
import path from "node:path";

export type QaRole =
  | "superadmin"
  | "admin"
  | "manager"
  | "tech"
  | "security"
  | "inventory";

const ROLE_EMAIL_ENV: Record<QaRole, string> = {
  superadmin: "E2E_SUPERADMIN_EMAIL",
  admin: "E2E_ADMIN_EMAIL",
  manager: "E2E_MANAGER_EMAIL",
  tech: "E2E_TECH_EMAIL",
  security: "E2E_SECURITY_EMAIL",
  inventory: "E2E_INVENTORY_EMAIL"
};

const DEFAULT_EMAILS: Record<QaRole, string> = {
  superadmin: "superadmin@maintainpro.local",
  admin: "admin@maintainpro.local",
  manager: "manager@maintainpro.local",
  tech: "tech@maintainpro.local",
  security: "security@maintainpro.local",
  inventory: "inventory@maintainpro.local"
};

let loaded = false;

/** Load maintainpro/.env.e2e into process.env (never commits secrets). */
export function loadQaE2eEnv(force = false): void {
  if (loaded && !force) return;

  const candidates = [
    path.resolve(process.cwd(), "../../.env.e2e"),
    path.resolve(process.cwd(), "../.env.e2e"),
    path.resolve(process.cwd(), ".env.e2e"),
    path.resolve(process.cwd(), "../../../.env.e2e")
  ];

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    const text = fs.readFileSync(filePath, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env) || force) {
        process.env[key] = value;
      }
    }
    loaded = true;
    return;
  }

  loaded = true;
}

export function e2ePassword(): string {
  loadQaE2eEnv();
  const password = (
    process.env.E2E_PASSWORD ||
    process.env.MAINTAINPRO_SEED_PASSWORD ||
    process.env.E2E_SEED_PASSWORD ||
    ""
  ).trim();
  if (!password) {
    throw new Error(
      "E2E_PASSWORD (or MAINTAINPRO_SEED_PASSWORD) is required. Copy maintainpro/.env.e2e.example to .env.e2e."
    );
  }
  return password;
}

export function e2eEmail(role: QaRole): string {
  loadQaE2eEnv();
  const fromEnv = (process.env[ROLE_EMAIL_ENV[role]] || "").trim();
  return fromEnv || DEFAULT_EMAILS[role];
}

export function e2eBaseUrl(): string {
  loadQaE2eEnv();
  return (process.env.E2E_BASE_URL || "http://127.0.0.1:3001").replace(/\/+$/, "");
}

export function e2eApiUrl(): string {
  loadQaE2eEnv();
  return (process.env.E2E_API_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
}

export function qaTag(prefix: string): string {
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  return `QA-E2E-${prefix}-${stamp}`;
}

export const AUTH_DIR = path.resolve(__dirname, "../../playwright/.auth");

export function authStatePath(role: QaRole): string {
  return path.join(AUTH_DIR, `${role}.json`);
}
