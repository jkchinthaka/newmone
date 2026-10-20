import { execFileSync } from "node:child_process";

export const dynamic = "force-dynamic";

const startedAt = new Date().toISOString();

export function GET() {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }
  let branch = "unknown";
  let sha = "unknown";
  try {
    branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).trim();
    sha = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    branch = "unknown";
    sha = "unknown";
  }
  return Response.json(
    {
      app: "MaintainPro",
      role: "web",
      worktreeId: process.env.CANONICAL_WORKTREE_ID ?? "unspecified",
      branch,
      sha,
      startedAt,
      apiTarget: process.env.NEXT_PUBLIC_API_URL ?? "unset"
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
