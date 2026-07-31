import { NextResponse } from "next/server";

import { resolveWebSafeBuildInfo } from "@/lib/release-metadata";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const data = resolveWebSafeBuildInfo();

  return NextResponse.json({
    success: true,
    data,
    message: "Build info fetched"
  });
}
