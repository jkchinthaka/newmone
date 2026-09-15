/**
 * After `prisma generate`, inject Phase 15 TypeScript enums into the generated client
 * so existing `import { RoleName } from "@prisma/client"` keeps working.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const enumsTs = path.join(root, "apps", "api", "src", "database", "prisma-enums.ts");
const clientDir = path.join(root, "node_modules", ".prisma", "client");

const src = fs.readFileSync(enumsTs, "utf8");
const enumNames = [...src.matchAll(/export enum (\w+)/g)].map((m) => m[1]);

// Emit CommonJS enums module
const jsLines = ["'use strict';", "/** Phase 15 enum shim — do not edit; regenerated */", ""];
for (const name of enumNames) {
  const body = src.match(new RegExp(`export enum ${name} \\{([^}]+)\\}`))?.[1] || "";
  const members = [...body.matchAll(/(\w+)\s*=\s*"([^"]+)"/g)];
  jsLines.push(`exports.${name} = {`);
  for (const [, k, v] of members) {
    jsLines.push(`  ${k}: "${v}",`);
  }
  jsLines.push(`};`);
  jsLines.push("");
}
fs.writeFileSync(path.join(clientDir, "maintainpro-enums.js"), jsLines.join("\n"));

const dtsLines = ["/** Phase 15 enum shim */", ""];
for (const name of enumNames) {
  const body = src.match(new RegExp(`export enum ${name} \\{([^}]+)\\}`))?.[1] || "";
  const members = [...body.matchAll(/(\w+)\s*=\s*"([^"]+)"/g)];
  dtsLines.push(`export declare enum ${name} {`);
  for (const [, k, v] of members) {
    dtsLines.push(`  ${k} = "${v}",`);
  }
  dtsLines.push(`}`);
  dtsLines.push("");
}
fs.writeFileSync(path.join(clientDir, "maintainpro-enums.d.ts"), dtsLines.join("\n"));

function patchFile(file, marker, appendJs, appendDts) {
  const p = path.join(clientDir, file);
  if (!fs.existsSync(p)) return;
  let text = fs.readFileSync(p, "utf8");
  if (text.includes(marker)) return;
  if (file.endsWith(".js")) {
    text += `\n${appendJs}\n`;
  } else {
    text += `\n${appendDts}\n`;
  }
  fs.writeFileSync(p, text);
}

const marker = "maintainpro-enums";
const appendJs = `const __mpEnums = require("./maintainpro-enums.js");\nObject.assign(exports, __mpEnums);`;
const appendDts = `export * from "./maintainpro-enums";`;

for (const f of ["index.js", "default.js", "edge.js"]) {
  patchFile(f, marker, appendJs, "");
}
for (const f of ["index.d.ts", "default.d.ts", "edge.d.ts"]) {
  patchFile(f, marker, "", appendDts);
}

console.log(`Patched Prisma client with ${enumNames.length} enums`);
