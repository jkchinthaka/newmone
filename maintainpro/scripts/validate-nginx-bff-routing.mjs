/**
 * Structural validation of Nginx BFF routing (NGINX-BFF-001 / NGINX-BFF-002).
 * Does not start containers or contact production.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const maintainproRoot = path.resolve(__dirname, "..");
const confPath = path.join(maintainproRoot, "infra", "nginx", "default.conf");

let failures = 0;
let passes = 0;

function pass(id, message) {
  passes += 1;
  console.log("PASS " + id + ": " + message);
}

function fail(id, message) {
  failures += 1;
  console.error("FAIL " + id + ": " + message);
}

function stripComments(text) {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const idx = line.indexOf("#");
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join("\n");
}

function main() {
  console.log("validate:nginx-routing - structural checks only\n");

  if (!existsSync(confPath)) {
    fail("NGINX-BFF-001", "Missing " + path.relative(maintainproRoot, confPath));
    process.exit(1);
  }

  const raw = readFileSync(confPath, "utf8");
  const text = stripComments(raw);

  const bffMatch = text.match(/location\s+\^~\s+\/api\/backend\/\s*\{([\s\S]*?)\}/);
  if (!bffMatch) {
    fail("NGINX-BFF-001", "Missing location ^~ /api/backend/ block");
  } else {
    const block = bffMatch[1];
    if (!/proxy_pass\s+http:\/\/maintainpro_web\s*;/.test(block)) {
      fail("NGINX-BFF-001", "BFF location must proxy_pass http://maintainpro_web; (no trailing slash)");
    } else {
      pass("NGINX-BFF-001", "BFF location proxies to maintainpro_web without URI rewrite");
    }
    if (/proxy_pass\s+http:\/\/maintainpro_web\//.test(block)) {
      fail("NGINX-BFF-001", "BFF proxy_pass must not append a path (would alter /api/backend URI)");
    }
    if (!/proxy_set_header\s+Host\s+\$host\s*;/.test(block)) {
      fail("NGINX-BFF-001", "BFF location must preserve Host");
    }
    if (!/proxy_set_header\s+X-Forwarded-Proto\s+\$scheme\s*;/.test(block)) {
      fail("NGINX-BFF-001", "BFF location must set X-Forwarded-Proto");
    }
    if (!/proxy_http_version\s+1\.1\s*;/.test(block)) {
      fail("NGINX-BFF-001", "BFF location must use HTTP/1.1");
    }
    if (!/proxy_buffer_size\s+32k\s*;/.test(block) || !/proxy_buffers\s+8\s+32k\s*;/.test(block)) {
      fail(
        "NGINX-BFF-003",
        "BFF location must enlarge proxy buffers for large Set-Cookie JWT responses"
      );
    } else {
      pass("NGINX-BFF-003", "BFF location has enlarged proxy buffers for login cookies");
    }
    if (!/proxy_set_header\s+X-Request-Id\s+\$maintainpro_request_id\s*;/.test(block)) {
      fail("NGINX-BFF-004", "BFF location must forward sanitized/generated X-Request-Id");
    } else {
      pass("NGINX-BFF-004", "BFF location forwards X-Request-Id");
    }
    if (!/map\s+\$http_x_request_id\s+\$maintainpro_request_id/.test(text)) {
      fail("NGINX-BFF-004", "Nginx must map missing X-Request-Id to \$request_id");
    }
  }

  const apiMatch = text.match(/location\s+\/api\/\s*\{([\s\S]*?)\}/);
  if (!apiMatch) {
    fail("NGINX-BFF-002", "Missing location /api/ block");
  } else {
    const block = apiMatch[1];
    if (!/proxy_pass\s+http:\/\/maintainpro_api\/api\/\s*;/.test(block)) {
      fail("NGINX-BFF-002", "Generic /api/ must proxy_pass http://maintainpro_api/api/;");
    } else {
      pass("NGINX-BFF-002", "Generic /api/ proxies to NestJS API upstream");
    }
    if (!/proxy_set_header\s+X-Request-Id\s+\$maintainpro_request_id\s*;/.test(block)) {
      fail("NGINX-BFF-005", "Generic /api/ must forward X-Request-Id");
    } else {
      pass("NGINX-BFF-005", "Generic /api/ forwards X-Request-Id");
    }
  }

  const socketMatch = text.match(/location\s+\/socket\.io\/\s*\{([\s\S]*?)\}/);
  if (!socketMatch) {
    fail("NGINX-BFF-002", "Missing /socket.io/ location");
  } else if (!/proxy_pass\s+http:\/\/maintainpro_api\/socket\.io\//.test(socketMatch[1])) {
    fail("NGINX-BFF-002", "/socket.io/ must proxy to maintainpro_api");
  } else if (!/proxy_set_header\s+X-Request-Id\s+\$maintainpro_request_id\s*;/.test(socketMatch[1])) {
    fail("NGINX-CORR-001", "/socket.io/ must forward X-Request-Id");
  } else {
    pass("NGINX-BFF-002", "/socket.io/ proxies to API with request correlation");
  }

  const rootMatch = text.match(/location\s+\/\s*\{([\s\S]*?)\}/);
  if (!rootMatch) {
    fail("NGINX-BFF-002", "Missing location / block");
  } else if (!/proxy_pass\s+http:\/\/maintainpro_web\s*;/.test(rootMatch[1])) {
    fail("NGINX-BFF-002", "Root location must proxy to maintainpro_web");
  } else {
    pass("NGINX-BFF-002", "Root location proxies to Web");
  }

  const bffIndex = text.search(/location\s+\^~\s+\/api\/backend\//);
  const apiIndex = text.search(/location\s+\/api\//);
  if (bffIndex < 0 || apiIndex < 0) {
    fail("NGINX-BFF-001", "Cannot verify BFF-before-/api/ ordering");
  } else if (bffIndex > apiIndex) {
    fail("NGINX-BFF-001", "/api/backend/ location must appear before generic /api/");
  } else {
    pass("NGINX-BFF-001", "/api/backend/ appears before generic /api/");
  }

  const illegalPublishes = [...text.matchAll(/\blisten\s+([^;]+);/g)].map((m) => m[1].trim());
  const badListens = illegalPublishes.filter((l) => {
    const normalized = l.replace(/\s+/g, " ");
    if (normalized === "80" || normalized.startsWith("80 ")) return false;
    if (normalized.includes("443")) return false;
    return true;
  });
  if (badListens.length) {
    fail("NGINX-BFF-002", "Unexpected listen directives (restricted ports risk): " + badListens.join(", "));
  } else {
    pass("NGINX-BFF-002", "Nginx listen set does not introduce API/DB/MinIO public ports");
  }

  console.log("\nSummary: " + passes + " passed, " + failures + " failed");
  if (failures > 0) process.exit(1);
}

main();