import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { NAVIGATION_ITEMS } from "../navigation";
import { ROLE_HOME_PROFILES } from "../role-home";
import { REMOVED_REPORT_SLUGS } from "../report-workspace";

type Segment = { kind: "static"; value: string } | { kind: "param" } | { kind: "catch" } | { kind: "optional-catch" };

const appRoot = fileURLToPath(new URL("../../app/", import.meta.url));

function pages(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...pages(path));
    else if (/^page\.(tsx|ts|jsx|js)$/.test(entry.name)) found.push(path);
  }
  return found;
}

function pattern(file: string): Segment[] {
  const dir = relative(appRoot, file).replace(/\\/g, "/").replace(/\/page\.[jt]sx?$/, "");
  return dir
    .split("/")
    .filter((part) => part && !/^\(.*\)$/.test(part) && !part.startsWith("@"))
    .map((part) => {
      if (part.startsWith("[[...") && part.endsWith("]]")) return { kind: "optional-catch" };
      if (part.startsWith("[...") && part.endsWith("]")) return { kind: "catch" };
      if (part.startsWith("[") && part.endsWith("]")) return { kind: "param" };
      return { kind: "static", value: part };
    });
}

const routePatterns = pages(appRoot).map(pattern);

function matches(route: Segment[], parts: string[]): boolean {
  let index = 0;
  for (const segment of route) {
    if (segment.kind === "optional-catch") return true;
    if (segment.kind === "catch") return index < parts.length;
    if (index >= parts.length) return false;
    if (segment.kind === "static" && segment.value !== parts[index]) return false;
    index += 1;
  }
  return index === parts.length;
}

function routeExists(href: string): boolean {
  const path = href.split(/[?#]/, 1)[0] || "/";
  const parts = path.split("/").filter(Boolean);
  return routePatterns.some((route) => matches(route, parts));
}

function internalHrefs(): string[] {
  const hrefs = [
    ...ROLE_HOME_PROFILES.flatMap((profile) => profile.cards.map((card) => card.href)),
    ...NAVIGATION_ITEMS.map((item) => item.href)
  ];
  return hrefs.filter((href) => href.startsWith("/") && !href.startsWith("//"));
}

describe("internal navigation routes", () => {
  it("resolves every role-home and navigation href to an app page", () => {
    const missing = [...new Set(internalHrefs())].filter((href) => !routeExists(href)).sort();
    assert.deepEqual(missing, []);
  });

  it("points maintenance cost at the work-order page that shows the cost breakdown", () => {
    const href = ROLE_HOME_PROFILES.flatMap((profile) => profile.cards)
      .find((card) => card.id === "cost")?.href;
    assert.equal(href, "/maintenance/jobs");
    assert.equal(routeExists(href ?? ""), true);
  });

  it("does not link role home to a removed report", () => {
    const removed = new Set<string>(REMOVED_REPORT_SLUGS);
    for (const href of ROLE_HOME_PROFILES.flatMap((profile) => profile.cards.map((card) => card.href))) {
      const path = href.split(/[?#]/, 1)[0] ?? "";
      const slug = path.startsWith("/reports/") ? path.slice("/reports/".length) : "";
      if (!slug || slug.includes("/")) continue;
      assert.equal(removed.has(slug), false, href);
    }
  });
});
