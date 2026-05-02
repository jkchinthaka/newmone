import { spawnSync } from "node:child_process";

function run(command, args, options = {}) {
  console.log(`> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("docker", ["compose", "-f", "docker-compose.dev.yml", "up", "-d", "--build"]);
run("docker", ["compose", "-f", "docker-compose.dev.yml", "exec", "-T", "api", "npm", "run", "db:seed"]);
run("node", ["scripts/smoke-local.mjs"]);

console.log("MaintainPro local stack is ready.");
console.log("API: http://localhost:3000/api/health");
console.log("Web: http://localhost:3001");
console.log("Admin: admin / Admin@1234");