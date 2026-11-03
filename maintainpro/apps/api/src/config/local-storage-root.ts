import { existsSync, realpathSync } from "node:fs";
import path from "node:path";

// src/config and dist/config have the same depth below apps/api.
// The install root must remain protected even when deployment omits .git.
export function isPrivateAbsoluteStorageRoot(value: string): boolean {
  if (!path.isAbsolute(value)) return false;
  try {
    const roots = new Set<string>([process.cwd(), path.resolve(__dirname, "../../../..")]);
    let directory = __dirname;
    while (true) {
      if (existsSync(path.join(directory, ".git"))) { roots.add(directory); break; }
      const parent = path.dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
    const resolved = path.resolve(value);
    const candidates = [resolved];
    if (existsSync(resolved)) candidates.push(realpathSync(resolved));
    return candidates.every(candidate => [...roots].every(root => {
      const relative = path.relative(root, candidate);
      return relative !== "" && (relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative));
    }));
  } catch {
    return false;
  }
}
