#!/usr/bin/env node
/**
 * Phase 15 — remove Prisma `mode: "insensitive"` (MongoDB-only) from API sources.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../apps/api/src");

const patterns = [
  /,\s*mode:\s*["']insensitive["']/g,
  /mode:\s*["']insensitive["']\s*,\s*/g,
  /\{\s*mode:\s*["']insensitive["']\s*\}/g
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

let changedFiles = 0;
let totalReplacements = 0;

for (const file of await walk(root)) {
  const original = await readFile(file, "utf8");
  let updated = original;
  let fileReplacements = 0;

  for (const pattern of patterns) {
    updated = updated.replace(pattern, (match) => {
      fileReplacements += 1;
      if (match.includes("{") && match.includes("}")) {
        return "{}";
      }
      return "";
    });
  }

  if (updated !== original) {
    await writeFile(file, updated, "utf8");
    changedFiles += 1;
    totalReplacements += fileReplacements;
    console.log(`updated ${path.relative(root, file)} (${fileReplacements})`);
  }
}

console.log(`Done: ${changedFiles} file(s), ${totalReplacements} replacement(s).`);
