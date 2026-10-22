import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, "../src");
const plan = JSON.parse(
  readFileSync(path.resolve(here, "../../../docs/handover/access/route-key-plan.json"), "utf8")
);

function walk(dir, files = []) {
  for (const entry of require("node:fs").readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".spec.ts")) files.push(full);
  }
  return files;
}

const classFile = new Map();
for (const file of walk(src)) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(/export class (\w+)/g)) {
    if (!classFile.has(match[1])) classFile.set(match[1], file);
  }
}

const byFile = new Map();
const missing = [];
for (const addition of plan.additions) {
  const file = classFile.get(addition.controller);
  if (!file) {
    missing.push(addition.controller);
    continue;
  }
  const list = byFile.get(file) ?? [];
  list.push(addition);
  byFile.set(file, list);
}

function decoratorName(decorator) {
  const expression = decorator.expression;
  if (ts.isCallExpression(expression) && ts.isIdentifier(expression.expression)) return expression.expression.text;
  if (ts.isIdentifier(expression)) return expression.text;
  return "";
}

let edited = 0;
for (const [file, additions] of byFile) {
  const original = readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, original, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const edits = [];
  function visit(node) {
    if (ts.isClassDeclaration(node) && node.name) {
      const wanted = additions.filter((item) => item.controller === node.name.text);
      for (const addition of wanted) {
        const method = node.members.find(
          (member) => ts.isMethodDeclaration(member) && member.name && member.name.text === addition.handler
        );
        if (!method) {
          missing.push(`${addition.controller}.${addition.handler}`);
          continue;
        }
        const decorators = ts.getDecorators?.(method) ?? method.decorators ?? [];
        const permissions = decorators.find((decorator) => decoratorName(decorator) === "Permissions");
        if (permissions && ts.isCallExpression(permissions.expression)) {
          const current = permissions.expression.arguments.map((argument) => argument.getText(source));
          if (current.some((argument) => argument.includes(addition.key))) continue;
          edits.push({ pos: permissions.expression.end - 1, text: `, "${addition.key}"` });
        } else {
          const at = decorators.length > 0 ? decorators[decorators.length - 1].end : method.getStart(source);
          edits.push({ pos: at, text: `\n  @Permissions("${addition.key}")` });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (edits.length === 0) continue;
  edits.sort((a, b) => b.pos - a.pos);
  let next = original;
  for (const edit of edits) next = `${next.slice(0, edit.pos)}${edit.text}${next.slice(edit.pos)}`;
  if (next.includes("@Permissions(") && !next.includes("permissions.decorator")) {
    const relative = path
      .relative(path.dirname(file), path.join(src, "common/decorators/permissions.decorator"))
      .replaceAll("\\", "/")
      .replace(/\.ts$/, "");
    const spec = relative.startsWith(".") ? relative : `./${relative}`;
    const importLine = `import { Permissions } from "${spec}";\n`;
    const firstImport = next.indexOf("import ");
    next = firstImport >= 0 ? `${next.slice(0, firstImport)}${importLine}${next.slice(firstImport)}` : `${importLine}${next}`;
  }
  if (next !== original) {
    writeFileSync(file, next);
    edited += 1;
  }
}

const keys = [...new Set(plan.additions.map((item) => item.key))].sort();
const catalogPath = path.join(src, "database/permission-catalog.ts");
let catalog = readFileSync(catalogPath, "utf8");
const fresh = keys.filter((key) => !catalog.includes(`"${key}"`));
if (fresh.length > 0) {
  const block = fresh.map((key) => `  "${key}",`).join("\n");
  catalog = catalog.replace(
    "\n];",
    `\n\n  // Access studio route keys. Held by the roles on the matching route.\n${block}\n];`
  );
  writeFileSync(catalogPath, catalog);
}

const grants = {};
for (const addition of plan.additions) {
  grants[addition.key] = addition.roles;
}
const grantPath = path.join(src, "database/access-studio-route-keys.ts");
writeFileSync(
  grantPath,
  `/** Generated from docs/handover/access/route-key-plan.json. */\nexport const ACCESS_STUDIO_ROUTE_GRANTS: Record<string, readonly string[]> = ${JSON.stringify(grants, null, 2)};\n`
);

console.log(`files=${edited} keys=${keys.length} missing=${missing.length}`);
if (missing.length > 0) console.log(missing.slice(0, 20).join("\n"));
