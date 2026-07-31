#!/usr/bin/env node
/**
 * Image-compatible HTTP healthcheck for Node-based containers.
 * No wget/curl. No env dumps. No response body printing.
 *
 * Usage:
 *   node container-http-healthcheck.cjs --host 127.0.0.1 --port 3000 --path /api/health --expect 200 --timeout-ms 4000
 */

"use strict";

const http = require("node:http");

function parseArgs(argv) {
  const out = {
    host: "127.0.0.1",
    port: null,
    path: "/",
    expect: 200,
    timeoutMs: 4000
  };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const val = argv[i + 1];
    if (key === "--host" && val) {
      out.host = val;
      i += 1;
    } else if (key === "--port" && val) {
      out.port = Number(val);
      i += 1;
    } else if (key === "--path" && val) {
      out.path = val.startsWith("/") ? val : `/${val}`;
      i += 1;
    } else if (key === "--expect" && val) {
      out.expect = Number(val);
      i += 1;
    } else if (key === "--timeout-ms" && val) {
      out.timeoutMs = Number(val);
      i += 1;
    } else if (key === "--help") {
      process.stderr.write(
        "Usage: node container-http-healthcheck.cjs --host 127.0.0.1 --port 3000 --path /api/health --expect 200 --timeout-ms 4000\n"
      );
      process.exit(2);
    }
  }
  return out;
}

function fail() {
  process.exit(1);
}

const opts = parseArgs(process.argv.slice(2));

if (!opts.host || opts.host === "0.0.0.0" || opts.host.includes("://")) {
  fail();
}
if (!Number.isInteger(opts.port) || opts.port < 1 || opts.port > 65535) {
  fail();
}
if (!Number.isInteger(opts.expect) || opts.expect < 100 || opts.expect > 599) {
  fail();
}
if (!Number.isInteger(opts.timeoutMs) || opts.timeoutMs < 100 || opts.timeoutMs > 60000) {
  fail();
}
if (opts.host !== "127.0.0.1" && opts.host !== "localhost") {
  fail();
}

const req = http.get(
  {
    host: opts.host,
    port: opts.port,
    path: opts.path
  },
  (res) => {
    res.resume();
    if (res.statusCode === opts.expect) {
      process.exit(0);
    }
    fail();
  }
);

req.on("error", () => fail());
req.setTimeout(opts.timeoutMs, () => {
  req.destroy();
  fail();
});