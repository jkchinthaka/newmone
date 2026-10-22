import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const writer = path.resolve(here, "write-access-route-keys.ts");
const result = spawnSync(process.execPath, ["--import", "tsx", writer], { stdio: "inherit" });
if (result.status !== 0) {
  console.error("Access keys are generated from the route inventory. Controllers are not edited.");
  process.exit(result.status ?? 1);
}
