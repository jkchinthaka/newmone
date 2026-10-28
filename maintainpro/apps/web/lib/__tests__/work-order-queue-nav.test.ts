import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = path.dirname(fileURLToPath(import.meta.url));

import {
  activeQueueFilterChips,
  formatQueueDue,
  nextActionLabel,
  queueFiltersAfterChipRemove,
  queuePurpose,
  splitQueueTabs,
  defaultWorkOrderQueueForRole,
  queueSearchReplaceTarget,
  queuesVisibleToRole,
  resolvedQueueFilters,
  reduceWorkOrderSearchUrl,
  commitSearchDraft,
  createSearchSync,
  noteSearchDraft,
  shouldKeepLocalSearch,
  writeQueueFiltersToSearch
} from "../work-order-queue-nav";
import {
  buildQueueListSearchParams,
  DEFAULT_QUEUE_FILTERS,
  FALLBACK_QUEUE_SUMMARY,
  queueFiltersFromSearch,
  workOrderQueueRequestKey
} from "../work-order-queues-api";

test("search text keeps spaces while a trimmed URL echo is in flight", () => {
  assert.equal(
    shouldKeepLocalSearch({ local: "pump ", urlQuery: "pump", echoedQuery: "pump", typingSinceEcho: false }),
    true
  );
  assert.equal(
    shouldKeepLocalSearch({ local: "pump motor", urlQuery: "pump", echoedQuery: "pump", typingSinceEcho: true }),
    true
  );
  assert.equal(
    shouldKeepLocalSearch({ local: "pump motor", urlQuery: "WO-123", echoedQuery: "pump", typingSinceEcho: false }),
    false
  );
  assert.equal(
    queueSearchReplaceTarget(
      new URLSearchParams("q=pump"),
      { ...DEFAULT_QUEUE_FILTERS, queue: "action-required", query: "pump " },
      "action-required"
    ),
    null
  );
  const spaced = queueSearchReplaceTarget(
    new URLSearchParams(),
    { ...DEFAULT_QUEUE_FILTERS, queue: "action-required", query: "pump motor" },
    "action-required"
  );
  assert.equal(new URLSearchParams(spaced ?? "").get("q"), "pump motor");
  assert.equal(spaced?.includes("pumpmotor"), false);
});

test("out-of-order URL echoes do not rewind a newer search draft", () => {
  const roleDefault = defaultWorkOrderQueueForRole("ADMIN");
  let sync = createSearchSync("");
  let filters = { ...DEFAULT_QUEUE_FILTERS, queue: roleDefault, query: "" };
  let url = new URLSearchParams();
  const fetches: string[] = [];
  const replaces: string[] = [];

  const publish = () => {
    const previous = filters.query;
    sync = commitSearchDraft(sync);
    if (filters.query === sync.committed) return;
    filters = { ...filters, query: sync.committed, page: 1 };
    fetches.push(buildQueueListSearchParams(filters).get("search") ?? "");
    const next = queueSearchReplaceTarget(url, filters, roleDefault);
    if (next === null) return;
    const params = new URLSearchParams(next);
    if (sync.issuedId > 0) params.set("qRev", String(sync.issuedId));
    const stamped = params.toString();
    if (stamped !== url.toString()) replaces.push(stamped);
    assert.notEqual(filters.query, previous);
  };

  const deliver = (search: string, fromHistory = false) => {
    const params = new URLSearchParams(search);
    const rawRevision = params.get("qRev");
    const reduced = reduceWorkOrderSearchUrl({
      sync,
      current: filters,
      linked: queueFiltersFromSearch({
        queue: params.get("queue"),
        q: params.get("q")
      }),
      role: "ADMIN",
      publicationId: rawRevision && /^\d+$/.test(rawRevision) ? Number(rawRevision) : null,
      fromHistory
    });
    sync = reduced.sync;
    if (reduced.draft !== null) sync = { ...sync, draft: reduced.draft };
    if (reduced.filters) {
      filters = reduced.filters;
      fetches.push(buildQueueListSearchParams(filters).get("search") ?? "");
      const next = queueSearchReplaceTarget(params, filters, roleDefault);
      if (next !== null) replaces.push(next);
    }
    url = params;
  };

  sync = noteSearchDraft(sync, "pump ");
  publish();
  assert.equal(sync.draft, "pump ");
  assert.equal(filters.query, "pump ");
  const first = replaces[0] ?? "";
  assert.equal(new URLSearchParams(first).get("q"), "pump");

  sync = noteSearchDraft(sync, "pump m");
  publish();
  const second = replaces[1] ?? "";
  assert.equal(new URLSearchParams(second).get("q"), "pump m");

  sync = noteSearchDraft(sync, "pump mo");
  deliver(first);
  assert.equal(sync.draft, "pump mo");
  assert.equal(filters.query, "pump m");
  deliver(second);
  assert.equal(sync.draft, "pump mo");
  assert.equal(filters.query, "pump m");

  publish();
  assert.equal(sync.draft, "pump mo");
  assert.equal(filters.query, "pump mo");
  assert.equal(new URLSearchParams(replaces[2] ?? "").get("q"), "pump mo");
  deliver(replaces[2] ?? "");
  const replaceCount = replaces.length;
  deliver(replaces[2] ?? "");
  assert.equal(replaces.length, replaceCount);
  assert.deepEqual(fetches, ["pump", "pump m", "pump mo"]);

  deliver("q=WO-123");
  assert.equal(sync.draft, "WO-123");
  assert.equal(filters.query, "WO-123");
  deliver(replaces[2] ?? "");
  assert.equal(sync.draft, "WO-123");
  assert.equal(filters.query, "WO-123");
  deliver(replaces[2] ?? "", true);
  assert.equal(sync.draft, "pump mo");
  assert.equal(filters.query, "pump mo");

  filters = { ...filters, queue: "overdue" };
  const queued = queueSearchReplaceTarget(url, filters, roleDefault);
  assert.equal(new URLSearchParams(queued ?? "").get("queue"), "overdue");
  assert.equal(new URLSearchParams(queued ?? "").get("q"), "pump mo");
  deliver(queued ?? "");
  assert.equal(filters.queue, "overdue");
  assert.equal(sync.draft, "pump mo");

  const invalid = reduceWorkOrderSearchUrl({
    sync,
    current: filters,
    linked: queueFiltersFromSearch({ queue: "not-a-queue", q: "pump mo" }),
    role: "ADMIN"
  });
  assert.equal(invalid.filters?.queue ?? filters.queue, "action-required");
  assert.equal(invalid.draft, null);

  const forbidden = reduceWorkOrderSearchUrl({
    sync: createSearchSync("pump mo"),
    current: { ...DEFAULT_QUEUE_FILTERS, queue: "my-tasks", query: "pump mo" },
    linked: queueFiltersFromSearch({ queue: "high-priority", q: "pump mo" }),
    role: "TECHNICIAN"
  });
  assert.equal(forbidden.filters?.queue ?? "my-tasks", "my-tasks");
  assert.equal(forbidden.draft, null);

  const switched = reduceWorkOrderSearchUrl({
    sync,
    current: { ...filters, queue: "action-required" },
    linked: queueFiltersFromSearch({ q: "pump mo" }),
    role: "TECHNICIAN"
  });
  assert.equal(switched.filters?.queue, "my-tasks");
  assert.equal(switched.draft, null);
  assert.equal(switched.filters?.query, "pump mo");
});

test("a completed search can be opened again and a late echo cannot rewind it", () => {
  const roleDefault = defaultWorkOrderQueueForRole("ADMIN");
  let sync = createSearchSync("");
  let filters = { ...DEFAULT_QUEUE_FILTERS, queue: roleDefault, query: "" };
  const fetches: string[] = [];
  const replaces: string[] = [];

  const publish = (draft: string) => {
    sync = commitSearchDraft(noteSearchDraft(sync, draft));
    filters = { ...filters, query: sync.committed, page: 1 };
    fetches.push(workOrderQueueRequestKey(filters));
    const next = queueSearchReplaceTarget(new URLSearchParams(), filters, roleDefault);
    const params = new URLSearchParams(next ?? "");
    params.set("qRev", String(sync.issuedId));
    replaces.push(params.toString());
  };

  const deliver = (search: string, fromHistory = false) => {
    const params = new URLSearchParams(search);
    const rawRevision = params.get("qRev");
    const before = filters.query;
    const reduced = reduceWorkOrderSearchUrl({
      sync,
      current: filters,
      linked: queueFiltersFromSearch({ queue: params.get("queue"), q: params.get("q") }),
      role: "ADMIN",
      publicationId: rawRevision && /^\d+$/.test(rawRevision) ? Number(rawRevision) : null,
      fromHistory
    });
    sync = reduced.sync;
    if (reduced.draft !== null) sync = { ...sync, draft: reduced.draft };
    if (reduced.filters) {
      filters = reduced.filters;
      if (filters.query !== before) fetches.push(workOrderQueueRequestKey(filters));
      const again = queueSearchReplaceTarget(params, filters, roleDefault);
      if (again !== null) replaces.push(again);
    }
  };

  publish("WO-123");
  deliver(replaces[0] ?? "");
  assert.equal(sync.draft, "WO-123");
  assert.equal(sync.settledThrough, 1);
  publish("WO-124");
  deliver(replaces[1] ?? "");
  assert.equal(sync.draft, "WO-124");
  assert.equal(sync.settledThrough, 2);

  deliver("q=WO-123");
  assert.equal(sync.draft, "WO-123");
  assert.equal(filters.query, "WO-123");
  assert.equal(filters.queue, "action-required");
  const replaceCount = replaces.length;
  deliver("q=WO-123");
  assert.equal(replaces.length, replaceCount);

  deliver(replaces[0] ?? "");
  assert.equal(sync.draft, "WO-123");
  assert.equal(filters.query, "WO-123");

  deliver("queue=overdue&q=WO-123");
  assert.equal(filters.queue, "overdue");
  assert.equal(sync.draft, "WO-123");
  assert.equal(filters.query, "WO-123");

  deliver(replaces[1] ?? "", true);
  assert.equal(sync.draft, "WO-124");
  assert.equal(filters.query, "WO-124");

  const invalid = reduceWorkOrderSearchUrl({
    sync,
    current: filters,
    linked: queueFiltersFromSearch({ queue: "not-a-queue", q: "WO-124" }),
    role: "ADMIN"
  });
  assert.equal(invalid.filters?.queue ?? filters.queue, "action-required");
  assert.equal(invalid.draft, null);

  const forbidden = reduceWorkOrderSearchUrl({
    sync: createSearchSync("WO-124"),
    current: { ...DEFAULT_QUEUE_FILTERS, queue: "my-tasks", query: "WO-124" },
    linked: queueFiltersFromSearch({ queue: "all", q: "WO-124" }),
    role: "TECHNICIAN"
  });
  assert.equal(forbidden.filters?.queue ?? "my-tasks", "my-tasks");
  assert.equal(forbidden.draft, null);
});

test("fallback queues hide actions a technician cannot open", () => {
  const visible = queuesVisibleToRole(FALLBACK_QUEUE_SUMMARY.queues, "TECHNICIAN").map((queue) => queue.key);
  assert.equal(visible.includes("my-tasks"), true);
  assert.equal(visible.includes("overdue"), true);
  assert.equal(visible.includes("all"), false);
  assert.equal(visible.includes("high-priority"), false);
  assert.equal(visible.includes("supervisor-verification"), false);
  assert.equal(queuesVisibleToRole([{ key: "my-tasks" as const, count: 0 }], "TECHNICIAN")[0]?.count, 0);
  assert.equal(queuesVisibleToRole(FALLBACK_QUEUE_SUMMARY.queues, "ADMIN").some((queue) => queue.key === "all"), true);
  const keeper = queuesVisibleToRole(FALLBACK_QUEUE_SUMMARY.queues, "INVENTORY_KEEPER").map((queue) => queue.key);
  assert.equal(keeper.includes("waiting-parts"), true);
  assert.equal(keeper.includes("all"), false);
  assert.equal(keeper.includes("high-priority"), false);
  assert.equal(keeper.includes("finance-vendor-pending"), false);
});

test("a queue-less URL keeps the search and the role default without a replace loop", () => {
  const adminBare = resolvedQueueFilters(queueFiltersFromSearch({}), "ADMIN");
  assert.equal(adminBare.queue, "action-required");
  assert.equal(queueSearchReplaceTarget(new URLSearchParams(), adminBare, "action-required"), null);

  const searched = resolvedQueueFilters(queueFiltersFromSearch({ q: "WO-123" }), "ADMIN");
  assert.equal(searched.queue, "action-required");
  assert.equal(searched.query, "WO-123");
  assert.equal(
    queueSearchReplaceTarget(new URLSearchParams("q=WO-123"), searched, "action-required"),
    null
  );

  const technician = resolvedQueueFilters(queueFiltersFromSearch({}), "TECHNICIAN");
  assert.equal(technician.queue, "my-tasks");
  assert.equal(queueSearchReplaceTarget(new URLSearchParams(), technician, "my-tasks"), null);
});

test("explicit, invalid, and forbidden queues resolve without keeping stale state", () => {
  const explicit = resolvedQueueFilters(queueFiltersFromSearch({ queue: "overdue", q: "WO-123" }), "ADMIN");
  assert.equal(explicit.queue, "overdue");
  assert.equal(explicit.query, "WO-123");
  assert.equal(
    queueSearchReplaceTarget(new URLSearchParams("queue=overdue&q=WO-123"), explicit, "action-required"),
    null
  );

  const back = resolvedQueueFilters(queueFiltersFromSearch({ q: "WO-123" }), "ADMIN");
  assert.equal(back.queue, "action-required");
  assert.equal(back.query, "WO-123");
  const forward = resolvedQueueFilters(queueFiltersFromSearch({ queue: "overdue", q: "WO-123" }), "ADMIN");
  assert.equal(forward.queue, "overdue");

  const invalid = resolvedQueueFilters(queueFiltersFromSearch({ queue: "not-a-queue", q: "WO-9" }), "ADMIN");
  assert.equal(invalid.queue, "action-required");
  assert.equal(invalid.query, "WO-9");

  const forbidden = resolvedQueueFilters(queueFiltersFromSearch({ queue: "high-priority" }), "TECHNICIAN");
  assert.equal(forbidden.queue, "my-tasks");
  const forbiddenAll = resolvedQueueFilters(queueFiltersFromSearch({ queue: "all" }), "TECHNICIAN");
  assert.equal(forbiddenAll.queue, "my-tasks");
});

test("selecting a queue replaces the current history entry and does not navigate again", () => {
  const bare = new URLSearchParams();
  const selected = queueSearchReplaceTarget(
    bare,
    { ...DEFAULT_QUEUE_FILTERS, queue: "overdue" },
    "action-required"
  );
  assert.equal(selected, "queue=overdue");

  const onExplicitQueue = new URLSearchParams(selected ?? "");
  assert.equal(
    queueSearchReplaceTarget(onExplicitQueue, { ...DEFAULT_QUEUE_FILTERS, queue: "overdue" }, "action-required"),
    null
  );
  assert.equal(
    queueSearchReplaceTarget(new URLSearchParams(), { ...DEFAULT_QUEUE_FILTERS, queue: "action-required" }, "action-required"),
    null
  );

  const panel = readFileSync(
    path.resolve(here, "../../components/work-orders/work-order-queue-panel.tsx"),
    "utf8"
  );
  assert.match(panel, /previousQuery !== nextQuery/);
  assert.match(panel, /router\.push\(href, \{ scroll: false \}\)/);
  assert.match(panel, /router\.replace\(href, \{ scroll: false \}\)/);
  assert.match(panel, /params\.set\("qRev", String\(issuedId\)\)/);
});

test("the default queue is not written back onto an otherwise matching URL", () => {
  assert.equal(defaultWorkOrderQueueForRole("ADMIN"), "action-required");
  assert.equal(defaultWorkOrderQueueForRole("TECHNICIAN"), "my-tasks");
  assert.equal(defaultWorkOrderQueueForRole("SUPERVISOR"), "supervisor-verification");
  assert.equal(defaultWorkOrderQueueForRole("INVENTORY_KEEPER"), "waiting-parts");
  assert.equal(defaultWorkOrderQueueForRole("VIEWER"), "my-tasks");

  const current = new URLSearchParams();
  assert.equal(
    queueSearchReplaceTarget(current, { ...DEFAULT_QUEUE_FILTERS, queue: "action-required" }, "action-required"),
    null
  );
  assert.equal(
    queueSearchReplaceTarget(current, { ...DEFAULT_QUEUE_FILTERS, queue: "overdue" }, "action-required"),
    "queue=overdue"
  );
});

test("primary queues stay visible and secondary queues move into More", () => {
  const queues = [
    { key: "action-required" as const, label: "Action Required", count: 2 },
    { key: "my-tasks" as const, label: "My Tasks", count: 1 },
    { key: "open-requests" as const, label: "Open Requests", count: 4 },
    { key: "open-load" as const, label: "Open Load", count: 8 },
    { key: "waiting-evidence" as const, label: "Waiting photos", count: 3 },
    { key: "all" as const, label: "All", count: 9 },
    { key: "overdue" as const, label: "Overdue", count: 1 }
  ];
  const split = splitQueueTabs(queues);
  assert.deepEqual(
    split.primary.map((queue) => queue.label),
    ["Action Required", "My Tasks", "Open", "Overdue"]
  );
  assert.deepEqual(
    split.more.map((queue) => queue.key),
    ["waiting-evidence", "open-load", "all"]
  );
  assert.equal(split.primary.find((queue) => queue.key === "open-requests")?.count, 4);
  assert.equal(split.more.find((queue) => queue.key === "open-load")?.label, "Open Load");
});

test("priority queues explain the count without changing the filter", () => {
  assert.match(queuePurpose("overdue"), /due date/);
  assert.match(queuePurpose("unassigned"), /no technician/);
  assert.match(queuePurpose("waiting-parts"), /parts/);
  assert.match(queuePurpose("supervisor-verification"), /supervisor/);
  assert.match(queuePurpose("high-priority"), /critical/);
  assert.equal(queuePurpose("completed"), "");
});

test("queue selection and filters round-trip through the URL", () => {
  const params = new URLSearchParams("wo=abc&filter=in-progress");
  writeQueueFiltersToSearch(params, {
    ...DEFAULT_QUEUE_FILTERS,
    queue: "overdue",
    priority: "HIGH",
    query: "pump",
    overdueOnly: true,
    page: 2
  });
  assert.equal(params.get("wo"), "abc");
  assert.equal(params.get("queue"), "overdue");
  assert.equal(params.get("filter"), null);
  const restored = queueFiltersFromSearch({
    queue: params.get("queue"),
    priority: params.get("priority"),
    q: params.get("q"),
    overdueOnly: params.get("overdueOnly"),
    page: params.get("page")
  });
  assert.equal(restored.queue, "overdue");
  assert.equal(restored.priority, "HIGH");
  assert.equal(restored.query, "pump");
  assert.equal(restored.overdueOnly, true);
  assert.equal(restored.page, 2);
});

test("assignee and domain filters are sent to the queue request", () => {
  const params = buildQueueListSearchParams({
    ...DEFAULT_QUEUE_FILTERS,
    technicianId: "user-1",
    jobDomain: "VEHICLE",
    evidenceStatus: "Missing",
    query: "WO-10"
  });
  assert.equal(params.get("technicianId"), "user-1");
  assert.equal(params.get("jobDomain"), "VEHICLE");
  assert.equal(params.get("evidenceStatus"), "Missing");
  assert.equal(params.get("search"), "WO-10");
  assert.equal(params.get("pageSize"), "25");
});

test("active filter chips can be listed and cleared by key", () => {
  const chips = activeQueueFilterChips({
    ...DEFAULT_QUEUE_FILTERS,
    priority: "HIGH",
    overdueOnly: true,
    unassigned: true
  });
  assert.deepEqual(
    chips.map((chip) => chip.label),
    ["High priority", "Overdue", "Unassigned"]
  );
  assert.equal(queueFiltersAfterChipRemove("priority").priority, "ALL");
  assert.equal(queueFiltersAfterChipRemove("overdueOnly").overdueOnly, false);
  assert.equal(queueFiltersAfterChipRemove("unassigned").unassigned, false);
  assert.deepEqual(queueFiltersAfterChipRemove("dates"), { dateFrom: "", dateTo: "", page: 1 });
});

test("due dates show overdue and upcoming hints", () => {
  const now = new Date("2026-10-08T00:00:00.000Z");
  assert.equal(formatQueueDue("2026-10-04T00:00:00.000Z", 4, now).hint, "4d overdue");
  assert.equal(formatQueueDue("2026-10-04T00:00:00.000Z", 4, now).overdue, true);
  assert.equal(formatQueueDue("2026-10-10T00:00:00.000Z", 0, now).hint, "Due in 2d");
  assert.equal(formatQueueDue(null, 0, now).date, "No due date");
});

test("queue requests stay on the current page and change when the page or filter changes", () => {
  const first = workOrderQueueRequestKey({ ...DEFAULT_QUEUE_FILTERS, queue: "assigned", query: "a" });
  const second = workOrderQueueRequestKey({ ...DEFAULT_QUEUE_FILTERS, queue: "assigned", page: 2 });
  const filtered = workOrderQueueRequestKey({
    ...DEFAULT_QUEUE_FILTERS,
    queue: "assigned",
    priority: "HIGH",
    query: "belt"
  });
  assert.equal(new URLSearchParams(first).get("page"), "1");
  assert.equal(new URLSearchParams(first).get("search"), null);
  assert.equal(new URLSearchParams(second).get("page"), "2");
  assert.notEqual(first, second);
  assert.equal(new URLSearchParams(filtered).get("priority"), "HIGH");
  assert.equal(new URLSearchParams(filtered).get("search"), "belt");
  assert.equal(new URLSearchParams(filtered).get("page"), "1");
});

test("next action prefers the server action, then parts and photos", () => {
  assert.equal(nextActionLabel({ actionRequired: [{ label: "Approval pending", severity: "HIGH" }] }).label, "Approval pending");
  assert.equal(nextActionLabel({ partsStatus: "Waiting issue" }).label, "Waiting for parts");
  assert.equal(nextActionLabel({ evidenceStatus: "Missing" }).label, "Photos missing");
  assert.equal(nextActionLabel({ status: "VERIFIED" }).label, "Ready");
});
