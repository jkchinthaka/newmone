import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "../apps/web");
const testsDir = join(webRoot, "lib/__tests__");

function collect(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collect(path));
    else if (entry.name.endsWith(".test.ts")) files.push(path);
  }
  return files;
}

const files = collect(testsDir);
if (files.length === 0) {
  console.error("No web unit tests found under apps/web/lib/__tests__");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...files], {
  cwd: webRoot,
  stdio: "inherit"
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
