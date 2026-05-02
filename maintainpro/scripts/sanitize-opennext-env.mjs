import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));

const candidates = [
  path.join(process.cwd(), ".open-next", "cloudflare", "next-env.mjs"),
  path.join(process.cwd(), "apps", "web", ".open-next", "cloudflare", "next-env.mjs"),
  path.join(scriptDirectory, "..", "apps", "web", ".open-next", "cloudflare", "next-env.mjs")
];

const envFilePath = candidates.find((candidate) => existsSync(candidate));

if (!envFilePath) {
  console.warn("[sanitize-opennext-env] OpenNext env file was not found; skipping.");
  process.exit(0);
}

const safeEnv = {
  NODE_ENV: "production",
  NEXTJS_ENV: process.env.NEXTJS_ENV || "production"
};

for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith("NEXT_PUBLIC_") && value !== undefined) {
    safeEnv[key] = value;
  }
}

const content = ["production", "development", "test"]
  .map((mode) => `export const ${mode} = ${JSON.stringify(safeEnv)};`)
  .join("\n") + "\n";

writeFileSync(envFilePath, content, "utf8");
console.log(`[sanitize-opennext-env] Wrote safe env fallback to ${path.relative(process.cwd(), envFilePath)}`);