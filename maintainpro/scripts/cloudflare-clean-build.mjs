import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(scriptDir, "..", "apps", "web");

for (const target of [".next", ".open-next"]) {
  const fullPath = path.join(webRoot, target);
  rmSync(fullPath, { recursive: true, force: true });
  console.log(`removed=${path.relative(process.cwd(), fullPath)}`);
}

console.log("cloudflare_clean=complete");
