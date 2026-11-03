import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const src = (...parts: string[]) =>
  readFileSync(path.resolve(__dirname, "../..", ...parts), "utf8").replace(/\r\n/g, "\n");

test("Report a problem: describe step can send at once and keeps urgency at Normal", () => {
  const page = src("app/(dashboard)/requests/new/page.tsx");
  assert.match(page, /useState<ReportedUrgency>\("NORMAL"\)/);
  assert.match(page, /onClick=\{\(\) => void submit\(\)\}/);
  assert.match(page, /Send now/);
  assert.match(page, /More details/);
  // The review step stays reachable for people who want to check everything.
  assert.match(page, /onClick=\{\(\) => setStep\(4\)\}/);
});

test("Job detail: daily tabs stay short and rare sections live under More", () => {
  const tabs = src("components/work-orders/work-order-detail-tabs.tsx");
  assert.match(tabs, /WORK_ORDER_MORE_TABS: WorkOrderDetailTab\[\] = \["safety", "vendor-repair", "history", "audit"\]/);
  assert.match(tabs, /aria-haspopup="menu"/);
  assert.match(tabs, /event\.key === "Escape"/);
  // A deep link to a folded tab must still open it.
  assert.match(tabs, /hideTabs\?\.includes\(tab\.id\) && tab\.id !== activeTab/);
});

test("Assets and Vehicles lists remember the last status, sort and page size per person", () => {
  const helper = src("lib/remembered-filters.ts");
  assert.match(helper, /userScopedStorageKey\(base\)/);
  assert.match(helper, /catch/);
  const assets = src("components/assets/assets-management-page.tsx");
  assert.match(assets, /loadRememberedFilters/);
  assert.match(assets, /saveRememberedFilters\(ASSET_FILTER_MEMORY_KEY/);
  // A link that carries filters in the address must win over what was remembered.
  assert.match(assets, /urlHasFilters \? \{\}/);
  const vehicles = src("app/(dashboard)/vehicles/page.tsx");
  assert.match(vehicles, /loadRememberedFilters/);
  assert.match(vehicles, /PAGE_SIZE_OPTIONS as readonly number\[\]\)\.includes\(saved\.pageSize\)/);
  assert.match(vehicles, /if \(!filtersRestored\) return;/);
});

import { loadRememberedFilters, saveRememberedFilters } from "../remembered-filters";

function withFakeBrowser(run: (store: Map<string, string>) => void) {
  const store = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key)
    }
  };
  try {
    run(store);
  } finally {
    delete (globalThis as { window?: unknown }).window;
  }
}

test("remembered filters round-trip only the allowed keys", () => {
  withFakeBrowser(() => {
    saveRememberedFilters("t:list", { status: "ACTIVE", search: "pump", pageSize: 50 }, ["status", "pageSize"]);
    const loaded = loadRememberedFilters<{ status: string; search: string; pageSize: number }>("t:list", ["status", "search", "pageSize"]);
    assert.deepEqual(loaded, { status: "ACTIVE", pageSize: 50 });
  });
});

test("remembered filters ignore broken or hostile stored data", () => {
  withFakeBrowser((store) => {
    saveRememberedFilters("t:x", { status: "a" }, ["status"]);
    const key = [...store.keys()].find((k) => k.startsWith("t:x"));
    assert.ok(key, "a scoped key was written");
    store.set(key as string, "{not json");
    assert.deepEqual(loadRememberedFilters("t:x", ["status"]), {});
    store.set(key as string, JSON.stringify(["x"]));
    assert.deepEqual(loadRememberedFilters("t:x", ["status"]), {});
    store.set(key as string, JSON.stringify({ status: { nested: true }, pageSize: 25 }));
    assert.deepEqual(loadRememberedFilters<{ status: string; pageSize: number }>("t:x", ["status", "pageSize"]), { pageSize: 25 });
  });
});

test("remembered filters do nothing on the server", () => {
  assert.deepEqual(loadRememberedFilters("t:ssr", ["status"]), {});
  saveRememberedFilters("t:ssr", { status: "x" }, ["status"]);
});

test("the vendor directory menu entry is called Vendors, matching the Buying home", () => {
  const nav = src("lib", "navigation.ts");
  assert.match(nav, /id: "vendors-external",\n\s+label: "Vendors",/);
  assert.doesNotMatch(nav, /Outside Repairs/);
});

test("Requests list remembers Priority, Type and sort, but only when the link has no filters", () => {
  const page = src("app", "(dashboard)", "requests", "page.tsx");
  assert.match(page, /REQUEST_FILTER_MEMORY_FIELDS = \["priority", "type", "sort", "dir"\] as const/);
  assert.match(page, /if \(hasExplicit\) return;/);
  assert.match(page, /parseJobDomain\(saved\.type\)/);
  assert.match(page, /if \(!filtersRestored\.current\) return;/);
});

test("Add assignee needs only the person; hours and planned times are optional and the button never sticks", () => {
  const panel = src("components", "work-orders", "work-order-assignees-panel.tsx");
  assert.match(panel, /const hoursEntered = estimatedHours\.trim\(\) !== ""/);
  assert.match(panel, /return !plannedStartAt && !plannedEndAt;/);
  assert.match(panel, /estimatedHours: hoursEntered \? parsedEstimatedHours : undefined/);
  assert.match(panel, /Choose who will do this job first\./);
  assert.doesNotMatch(panel, /event\.currentTarget\.disabled = true/);
  assert.match(panel, /addInFlight\.current = false;/);
});

test("the footer Assign technician button is hidden while the Assignment tab is already open", () => {
  const modal = src("components", "work-orders", "work-order-editor-modal.tsx");
  assert.match(modal, /!\(next\.actionId === "assign" && activeTab === "assignment"\)/);
});

test("a technician job card shows one way into the job, not Open job and Open details together", () => {
  const page = src("app", "(dashboard)", "work-orders", "my", "page.tsx");
  assert.match(page, /function jobActionIsDetailsLink\(job: MyJob\): boolean/);
  assert.match(page, /\{jobActionIsDetailsLink\(job\) \? null : \(/);
});

test("Verify & close asks the supervisor to check the photos first", () => {
  const page = src("components", "work-orders", "work-orders-page.tsx");
  assert.match(page, /if \(selected === "verify-close"\) \{\n\s+const photosChecked = await confirm\(/);
  assert.match(page, /Photos checked, close it/);
});
