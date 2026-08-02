#!/usr/bin/env node
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
if (!existsSync(path.join(root, "docs/training/TRAINING_PLAN.md"))) process.exit(1);
console.log("PASS training-readiness-contract");