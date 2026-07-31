import { NextRequest } from "next/server";

import { proxyBffRequest } from "@/lib/bff-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handle(request: NextRequest, context: { params: { path: string[] } }) {
  const path = context.params?.path ?? [];
  return proxyBffRequest(request, path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
