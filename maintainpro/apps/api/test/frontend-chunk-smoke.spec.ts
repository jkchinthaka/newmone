import { describe, expect, it } from "@jest/globals";

function extractChunkUrls(html: string) {
  return [...new Set([...html.matchAll(/\/_next\/static\/chunks\/[^"'\s]+/g)].map((match) => match[0]))];
}

function isJavaScriptContentType(contentType: string | null | undefined) {
  const normalized = (contentType ?? "").toLowerCase();
  return normalized.includes("javascript") || normalized.includes("ecmascript");
}

describe("frontend chunk smoke helpers", () => {
  it("extracts unique Next.js chunk references from HTML", () => {
    const html = `
      <script src="/_next/static/chunks/webpack-abc.js"></script>
      <script src="/_next/static/chunks/app/(dashboard)/maintenance/job-codes/page-def.js"></script>
      <script src="/_next/static/chunks/webpack-abc.js"></script>
    `;
    expect(extractChunkUrls(html)).toEqual([
      "/_next/static/chunks/webpack-abc.js",
      "/_next/static/chunks/app/(dashboard)/maintenance/job-codes/page-def.js"
    ]);
  });

  it("accepts javascript content types for chunk responses", () => {
    expect(isJavaScriptContentType("application/javascript")).toBe(true);
    expect(isJavaScriptContentType("text/javascript")).toBe(true);
    expect(isJavaScriptContentType("text/html; charset=utf-8")).toBe(false);
  });
});
