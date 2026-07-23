import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const apiOrigin =
  process.env.NEXT_PUBLIC_API_ORIGIN?.replace(/\/+$/, "") ?? "https://newmone.onrender.com";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Monorepo root (`maintainpro/`) — required so standalone tracing includes workspace packages. */
const monorepoRoot = path.join(__dirname, "..", "..");
const isCpanelDeployment = process.env.DEPLOYMENT_TARGET === "cpanel";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  `connect-src 'self' ${apiOrigin} wss: ws: https:`,
  "worker-src 'self' blob:"
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), payment=(), usb=()"
  }
];

const nextConfig = {
  reactStrictMode: true,
  ...(isCpanelDeployment ? { output: "standalone" } : {}),
  experimental: {
    typedRoutes: true,
    // Next.js 14: keep tracing root under experimental so monorepo workspace deps are included.
    ...(isCpanelDeployment ? { outputFileTracingRoot: monorepoRoot } : {})
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders
      }
    ];
  }
};

export default nextConfig;
