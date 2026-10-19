import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(scriptDir, "canonical-project.json"), "utf8"));
const root = config.projectRoot;
const worktreeId = config.id;
const protectedPorts = new Set([3000, 3001, 3010, 3011, 3023, 3120, 3123]);

function commandOwnsCanonical(commandLine) {
  return String(commandLine ?? "").toLowerCase().includes(String(root).toLowerCase());
}

function matches(info, role, branch, sha) {
  return Boolean(
    info &&
      info.app === "MaintainPro" &&
      info.role === role &&
      info.worktreeId === worktreeId &&
      info.branch === branch &&
      info.sha === sha
  );
}

export function selectPort(preferred, searchEnd, role, branch, sha, probe) {
  const current = probe(preferred);
  if (current.free) return { port: preferred, reuse: false, reason: "preferred-free" };
  if (current.canonical && matches(current.identity, role, branch, sha)) {
    return { port: preferred, reuse: true, reason: "identity-match" };
  }
  for (let port = preferred + 1; port <= searchEnd; port += 1) {
    if (protectedPorts.has(port)) continue;
    if (probe(port).free) return { port, reuse: false, reason: "preferred-owned-by-other-worktree" };
  }
  throw new Error(`No free port from ${preferred} through ${searchEnd}. The occupied port was left running.`);
}

function selfTest() {
  const branch = "fix/enterprise-remediation-20261015";
  const sha = "a79859dc";
  const listeners = new Map([
    [3001, { free: false, canonical: false, identity: null }],
    [3041, { free: true }]
  ]);
  const probe = (port) => listeners.get(port) ?? { free: true };
  const fresh = selectPort(3041, 3059, "web", branch, sha, probe);
  if (fresh.port !== 3041 || fresh.reuse) throw new Error("expected free port 3041");
  listeners.set(3041, {
    free: false,
    canonical: true,
    identity: { app: "MaintainPro", role: "web", worktreeId, branch, sha }
  });
  const reused = selectPort(3041, 3059, "web", branch, sha, probe);
  if (!reused.reuse) throw new Error("matching server was not reused");
  listeners.set(3041, { free: false, canonical: false, identity: null });
  const moved = selectPort(3041, 3059, "web", branch, sha, probe);
  if (moved.port === 3041 || moved.port === 3001) throw new Error("old or occupied port was selected");
  const stale = { free: false, canonical: true, identity: { app: "MaintainPro", role: "web", worktreeId: "other", branch, sha } };
  listeners.set(3042, stale);
  if (commandOwnsCanonical(`node ${root}\\apps\\web`) !== true) throw new Error("canonical path check failed");
  if (commandOwnsCanonical("node C:\\Users\\chint\\OneDrive\\Pictures\\newmone\\maintainpro\\apps\\web") !== false) {
    throw new Error("OneDrive server was treated as canonical");
  }
  console.log("SELFTEST PASS");
  console.log(`worktreeId=${worktreeId}`);
  console.log(`projectRoot=${root}`);
}

function portFree(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

async function readIdentity(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function choose(preferred, role, branch, sha) {
  const probe = async (port) => {
    if (await portFree(port)) return { free: true };
    const info = await readIdentity(`http://127.0.0.1:${port}/dev/identity`);
    return { free: false, canonical: matches(info, role, branch, sha), identity: info };
  };
  const current = await probe(preferred);
  if (current.free) return { port: preferred, reuse: false };
  if (current.canonical) return { port: preferred, reuse: true };
  for (let port = preferred + 1; port <= config.portSearchEnd; port += 1) {
    if (protectedPorts.has(port)) continue;
    if ((await probe(port)).free) return { port, reuse: false };
  }
  throw new Error(`No free ${role} port. Existing servers were left running.`);
}

function launch(name, cwd, command) {
  const stateDir = join(root, ".dev-current");
  mkdirSync(stateDir, { recursive: true });
  const child = spawn("cmd.exe", ["/d", "/s", "/c", command], {
    cwd,
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  child.unref();
  writeFileSync(join(stateDir, `${name}.pid`), String(child.pid));
}

async function waitFor(url, role, branch, sha) {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    const info = await readIdentity(url);
    if (matches(info, role, branch, sha)) return info;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return null;
}

async function main() {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  if (pkg.name !== "maintainpro") throw new Error("Canonical package is not maintainpro.");
  readFileSync(join(root, "node_modules", "next", "dist", "bin", "next"));
  readFileSync(join(root, "apps", "api", "src", "main.ts"));
  try {
    readFileSync(join(root, ".env"));
  } catch {
    console.error(`Canonical worktree has no .env. Create ${join(root, ".env")} from .env.example. This launcher will not borrow another checkout's environment.`);
    process.exitCode = 2;
    return;
  }
  const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const sha = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const api = await choose(config.preferredApiPort, "api", branch, sha);
  const web = await choose(config.preferredWebPort, "web", branch, sha);
  if (!api.reuse) {
    launch("api", join(root, "apps", "api"), `set PORT=${api.port}&& set NODE_ENV=development&& set CANONICAL_WORKTREE_ID=${worktreeId}&& node --watch --watch-path=src -r ts-node/register/transpile-only src/main.ts`);
  }
  if (!web.reuse) {
    const apiUrl = `http://127.0.0.1:${api.port}/api`;
    const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");
    launch("web", join(root, "apps", "web"), `set NODE_ENV=development&& set CANONICAL_WORKTREE_ID=${worktreeId}&& set NEXT_PUBLIC_API_URL=${apiUrl}&& set NEXT_PUBLIC_API_BASE_URL=${apiUrl}&& set API_INTERNAL_URL=${apiUrl}&& node "${nextBin}" dev -p ${web.port}`);
  }
  const apiIdentity = await waitFor(`http://127.0.0.1:${api.port}/dev/identity`, "api", branch, sha);
  const webIdentity = await waitFor(`http://127.0.0.1:${web.port}/dev/identity`, "web", branch, sha);
  if (!apiIdentity || !webIdentity) {
    console.error("Startup identity check failed. The browser was not opened. Existing servers on other ports were left running.");
    process.exitCode = 1;
    return;
  }
  const url = `http://127.0.0.1:${web.port}/login`;
  const stateDir = join(root, ".dev-current");
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(join(stateDir, "state.json"), JSON.stringify({
    worktreeId,
    projectRoot: root,
    branch,
    sha,
    apiPort: api.port,
    webPort: web.port,
    apiUrl: `http://127.0.0.1:${api.port}/api`,
    webUrl: url,
    startedAt: webIdentity.startedAt
  }, null, 2));
  console.log("CANONICAL START OK");
  console.log(`worktree=${root}`);
  console.log(`id=${worktreeId} branch=${branch} sha=${sha}`);
  console.log(`api=http://127.0.0.1:${api.port} web=${url}`);
  if (!process.argv.includes("--no-browser")) {
    spawn("cmd.exe", ["/d", "/s", "/c", "start", "", url], { detached: true, stdio: "ignore", windowsHide: true }).unref();
  }
}

const isDirectRun = process.argv[1] && process.argv[1].endsWith("start-current.mjs");
if (isDirectRun) {
  const run = process.argv.includes("--self-test") ? Promise.resolve(selfTest()) : main();
  run.catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
