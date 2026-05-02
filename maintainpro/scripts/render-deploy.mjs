import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function stripQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key]) {
      continue;
    }

    const value = stripQuotes(trimmed.slice(separatorIndex + 1).trim());
    process.env[key] = value;
  }
}

const projectRoot = process.cwd();
for (const fileName of [".env.render.local", ".env.local"]) {
  loadEnvFile(path.join(projectRoot, fileName));
}

const isDryRun = process.argv.includes("--dry-run");
const apiBaseUrl = (process.env.RENDER_API_BASE_URL ?? "https://api.render.com/v1").replace(/\/+$/, "");
const apiKey = (process.env.RENDER_API_KEY ?? "").trim();
const serviceIdFromEnv = (process.env.RENDER_SERVICE_ID ?? "").trim();
const serviceName = (process.env.RENDER_SERVICE_NAME ?? "").trim();

if (!apiKey) {
  console.error("Missing RENDER_API_KEY. Put it in .env.render.local or your shell environment.");
  process.exit(1);
}

async function renderFetch(endpoint, init = {}) {
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${apiKey}`,
    ...init.headers
  };

  if (init.body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${apiBaseUrl}${endpoint}`, {
    ...init,
    headers
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text ? { raw: text } : null;
  }

  if (!response.ok) {
    const errorMessage =
      data?.message ??
      data?.error ??
      data?.raw ??
      `Request failed with HTTP ${response.status}`;
    throw new Error(`Render API ${response.status}: ${errorMessage}`);
  }

  return data;
}

function normalizeServices(payload) {
  if (!Array.isArray(payload)) {
    return [];
  }

  const services = [];
  for (const item of payload) {
    if (item?.service && item.service.id) {
      services.push(item.service);
      continue;
    }
    if (item?.id) {
      services.push(item);
    }
  }

  return services;
}

function normalizeLower(value) {
  return String(value ?? "").trim().toLowerCase();
}

async function resolveServiceId() {
  if (serviceIdFromEnv) {
    return serviceIdFromEnv;
  }

  if (!serviceName) {
    throw new Error("Missing RENDER_SERVICE_ID or RENDER_SERVICE_NAME.");
  }

  const payload = await renderFetch("/services?limit=100");
  const services = normalizeServices(payload);
  const target = normalizeLower(serviceName);

  const exactMatches = services.filter((service) => {
    return [service.name, service.slug].some((value) => normalizeLower(value) === target);
  });

  const partialMatches = services.filter((service) => {
    return [service.name, service.slug].some((value) => normalizeLower(value).includes(target));
  });

  const matches = exactMatches.length > 0 ? exactMatches : partialMatches;

  if (matches.length === 0) {
    throw new Error(`No Render service found for name/slug '${serviceName}'.`);
  }

  if (matches.length > 1) {
    const details = matches
      .map((service) => `${service.name} (${service.slug}) -> ${service.id}`)
      .join("; ");
    throw new Error(`Multiple services matched '${serviceName}': ${details}`);
  }

  const resolved = matches[0];
  console.log(`Resolved Render service '${resolved.name}' (${resolved.slug}) to ${resolved.id}.`);
  return resolved.id;
}

async function run() {
  const serviceId = await resolveServiceId();

  if (isDryRun) {
    const service = await renderFetch(`/services/${serviceId}`);
    console.log(
      JSON.stringify(
        {
          id: service?.id,
          name: service?.name,
          slug: service?.slug,
          type: service?.type,
          runtime: service?.serviceDetails?.runtime,
          url: service?.serviceDetails?.url,
          dashboardUrl: service?.dashboardUrl
        },
        null,
        2
      )
    );
    return;
  }

  const clearCache = /^(1|true|yes)$/i.test((process.env.RENDER_DEPLOY_CLEAR_CACHE ?? "").trim());
  const deployment = await renderFetch(`/services/${serviceId}/deploys`, {
    method: "POST",
    body: JSON.stringify({ clearCache })
  });

  const deploy = deployment?.deploy ?? deployment;
  console.log("Render deploy triggered successfully.");
  console.log(
    JSON.stringify(
      {
        serviceId,
        deployId: deploy?.id ?? null,
        status: deploy?.status ?? null,
        clearCache,
        createdAt: deploy?.createdAt ?? null,
        commitId: deploy?.commit?.id ?? null
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
