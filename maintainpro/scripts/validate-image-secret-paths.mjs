#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const images = process.argv.slice(2);
if (!images.length) {
  console.error("Usage: node scripts/validate-image-secret-paths.mjs <image> [<image>...]");
  process.exit(2);
}

const FORBIDDEN = [
  "(^|/)\\.env$",
  "(^|/)\\.env\\.local$",
  "(^|/)\\.env\\.production$",
  "(^|/)\\.env\\.development$",
  "\\.pem$",
  "\\.key$",
  "\\.pfx$",
  "\\.p12$",
  "-credentials\\.(json|txt)$"
];

let failed = 0;
for (const image of images) {
  console.log(`Inspecting image paths: ${image}`);
  const result = spawnSync(
    "docker",
    ["run", "--rm", "--entrypoint", "sh", image, "-c", "find / -type f 2>/dev/null | head -n 200000"],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, windowsHide: true }
  );
  if (result.error) {
    console.error(`FAIL DEPLOY-CONFIG-002: cannot run docker for ${image}: ${result.error.message}`);
    failed += 1;
    continue;
  }
  if (result.status !== 0) {
    console.error(`FAIL DEPLOY-CONFIG-002: docker run exited ${result.status} for ${image}`);
    failed += 1;
    continue;
  }
  const lines = result.stdout.split(/\r?\n/).filter(Boolean);
  const hits = [];
  for (const line of lines) {
    if (line.includes(".env.example") || line.includes(".env.compose-ci")) continue;
    for (const reSrc of FORBIDDEN) {
      if (new RegExp(reSrc).test(line)) {
        hits.push(line);
        break;
      }
    }
  }
  if (hits.length) {
    console.error(`FAIL DEPLOY-CONFIG-002: forbidden paths in ${image}:`);
    for (const h of hits.slice(0, 50)) console.error(`  ${h}`);
    failed += 1;
  } else {
    console.log(`PASS DEPLOY-CONFIG-002: no forbidden .env/key paths in ${image}`);
  }
}
process.exit(failed ? 1 : 0);
