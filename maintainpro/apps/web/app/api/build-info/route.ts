import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function readEnv(key: string): string {
  return (process.env[key] ?? "").trim();
}

export async function GET() {
  const commitSha =
    readEnv("APP_COMMIT_SHA") ||
    readEnv("NEXT_PUBLIC_APP_COMMIT_SHA") ||
    readEnv("CF_PAGES_COMMIT_SHA") ||
    readEnv("GITHUB_SHA") ||
    readEnv("VERCEL_GIT_COMMIT_SHA") ||
    "unknown";

  const buildTimestamp =
    readEnv("APP_BUILD_TIMESTAMP") ||
    readEnv("NEXT_PUBLIC_APP_BUILD_TIMESTAMP") ||
    null;

  const environment =
    readEnv("APP_ENVIRONMENT") ||
    readEnv("NEXT_PUBLIC_APP_ENVIRONMENT") ||
    readEnv("NODE_ENV") ||
    "development";

  const version =
    readEnv("APP_VERSION") ||
    readEnv("NEXT_PUBLIC_APP_VERSION") ||
    "1.2.0";

  return NextResponse.json({
    success: true,
    data: {
      service: "maintainpro-web",
      commitSha,
      buildTimestamp,
      environment,
      version
    },
    message: "Build info fetched"
  });
}