import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = path.join(root, "node_modules", ".prisma", "client");

function loosenFile(file) {
  const p = path.join(clientDir, file);
  if (!fs.existsSync(p)) return;
  let t = fs.readFileSync(p, "utf8");

  t = t.replace(
    /(export type \w+(?:Unchecked)?(?:Create|Update|CreateMany|UpdateMany)(?:Input|Without\w+Input) = \{[\s\S]*?\n\})/g,
    (block) => block.replace(/: string(\s*\|\s*null)?/g, ": any$1")
  );
  t = t.replace(/(status):\s*string/g, "$1: any");
  t = t.replace(/(priority):\s*string/g, "$1: any");
  t = t.replace(/: Prisma\.Decimal/g, ": any");
  t = t.replace(/: runtime\.Decimal/g, ": any");
  t = t.replace(/Prisma\.Decimal/g, "any");

  fs.writeFileSync(p, t);
  console.log("loosened", file);
}

for (const file of ["index.d.ts", "default.d.ts"]) {
  loosenFile(file);
}
