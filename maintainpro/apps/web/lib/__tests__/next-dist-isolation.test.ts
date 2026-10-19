import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const webRoot = join(__dirname, "..", "..");

test("tracked tsconfig.json has no isolated .next-* dist-dir includes", () => {
  const tsconfig = JSON.parse(readFileSync(join(webRoot, "tsconfig.json"), "utf8")) as { include: string[] };
  const isolated = tsconfig.include.filter((entry) => /^\.next-/.test(entry));
  assert.deepEqual(isolated, []);
});

test("isolated dist dirs and the generated tsconfig are gitignored", () => {
  const ignore = readFileSync(join(webRoot, ".gitignore"), "utf8").split(/\r?\n/);
  assert.ok(ignore.includes(".next-*/"));
  assert.ok(ignore.includes("tsconfig.isolated.json"));
});

test("an isolated NEXT_DIST_DIR points Next at the generated tsconfig", async () => {
  const { resolveTypescriptConfigPath } = await import("../../next-dist-isolation.mjs");
  assert.equal(resolveTypescriptConfigPath(".next"), "tsconfig.json");
  assert.equal(resolveTypescriptConfigPath(undefined), "tsconfig.json");
  assert.equal(resolveTypescriptConfigPath(".next-release-x"), "tsconfig.isolated.json");
});
