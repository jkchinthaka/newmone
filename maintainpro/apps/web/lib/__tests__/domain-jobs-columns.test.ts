import assert from "node:assert/strict";
import test from "node:test";

import {
  assigneeLine,
  domainJobPaths,
  domainJobsColumns,
  machineAssetLine,
  odometerLine,
  registrationLine,
  serviceLocationLine,
  serviceTypeLine,
  vehicleWorkLine,
  withLockedJobDomain
} from "../domain-jobs-columns";
import { buildQueueListSearchParams, DEFAULT_QUEUE_FILTERS, queueFiltersFromSearch, workOrderQueueRequestKey } from "../work-order-queues-api";
import { writeQueueFiltersToSearch } from "../work-order-queue-nav";

const sample = {
  title: "Belt slip",
  type: "CORRECTIVE",
  typeNameSnapshot: "Corrective repair",
  primaryAssigneeName: "Nimal",
  asset: { name: "Conveyor", assetTag: "AST-1002" },
  vehicle: { registrationNo: "WP-1234", make: "Toyota", vehicleModel: "Hilux", currentMileage: 84210 },
  functionalLocation: { name: "Packing hall", code: "LOC-4" },
  site: { name: "Colombo" },
  vendorSupplier: { name: "City Motors" }
};

test("machinery, service, and vehicle tables keep only their own columns", () => {
  const machinery = domainJobsColumns("MACHINERY").map((column) => column.label);
  const service = domainJobsColumns("SERVICE").map((column) => column.label);
  const vehicle = domainJobsColumns("VEHICLE").map((column) => column.label);
  assert.deepEqual(machinery, [
    "WO",
    "Work / Machine Asset",
    "Status",
    "Priority",
    "Assignee",
    "Due",
    "Next action",
    "Open"
  ]);
  assert.equal(machinery.includes("Registration"), false);
  assert.equal(machinery.includes("Service Type"), false);
  assert.ok(service.includes("Work / Service Location"));
  assert.ok(service.includes("Service Type"));
  assert.ok(service.includes("Assignee / Vendor"));
  assert.equal(service.includes("Registration"), false);
  assert.ok(vehicle.includes("Work / Vehicle"));
  assert.ok(vehicle.includes("Registration"));
  assert.ok(vehicle.includes("Odometer / Next action"));
  assert.equal(vehicle.includes("Service Type"), false);
  assert.equal(domainJobsColumns("SERVICE").find((column) => column.key === "serviceType")?.hideUntilXl, true);
  assert.equal(domainJobsColumns("VEHICLE").find((column) => column.key === "registration")?.hideUntilXl, true);
});

test("domain lines use the fields already on the queue row", () => {
  assert.equal(machineAssetLine(sample), "AST-1002 • Conveyor");
  assert.equal(serviceLocationLine(sample), "LOC-4 • Packing hall");
  assert.equal(
    serviceLocationLine({ asset: { name: "Pump room", assetTag: "AST-9" } }),
    "AST-9 • Pump room"
  );
  assert.equal(odometerLine({ vehicle: { currentMileage: 0 } }), "");
  assert.equal(serviceTypeLine(sample), "Corrective repair");
  assert.equal(vehicleWorkLine(sample), "Toyota Hilux");
  assert.equal(registrationLine(sample), "WP-1234");
  assert.equal(odometerLine(sample), "84,210 km");
  assert.equal(assigneeLine(sample, "SERVICE"), "Nimal · City Motors");
  assert.equal(assigneeLine({ ...sample, primaryAssigneeName: "" }, "MACHINERY"), "Unassigned");
});

test("each domain page keeps its own queue URL and does not share another domain", () => {
  const paths = domainJobPaths();
  const cases = [
    ["MACHINERY", "overdue", paths.MACHINERY],
    ["SERVICE", "assigned", paths.SERVICE],
    ["VEHICLE", "waiting-parts", paths.VEHICLE]
  ] as const;
  for (const [domain, queue, path] of cases) {
    const params = new URLSearchParams();
    const filters = {
      ...DEFAULT_QUEUE_FILTERS,
      ...withLockedJobDomain({ queue, query: "belt", page: 2 }, domain)
    };
    writeQueueFiltersToSearch(params, filters);
    assert.equal(params.get("queue"), queue);
    assert.equal(params.get("jobDomain"), domain);
    assert.equal(params.get("page"), "2");
    assert.equal(`${path}?${params.toString()}`.includes(path), true);
    const restored = queueFiltersFromSearch({
      queue: params.get("queue"),
      jobDomain: params.get("jobDomain"),
      q: params.get("q"),
      page: params.get("page")
    });
    assert.equal(restored.queue, queue);
    assert.equal(restored.jobDomain, domain);
    assert.equal(restored.page, 2);
    const request = buildQueueListSearchParams(filters);
    assert.equal(request.get("jobDomain"), domain);
    assert.equal(request.get("queue"), queue);
    assert.equal(request.get("page"), "2");
    assert.equal(request.get("search"), "belt");
    assert.equal(workOrderQueueRequestKey(filters).includes(`jobDomain=${domain}`), true);
    for (const other of ["MACHINERY", "SERVICE", "VEHICLE"]) {
      if (other !== domain) assert.equal(request.get("jobDomain") === other, false);
    }
  }
});

test("clearing filters on a domain page does not drop the locked domain or stay on a later page", () => {
  const cleared = {
    ...DEFAULT_QUEUE_FILTERS,
    ...withLockedJobDomain({ queue: "overdue", query: "pump", page: 4, jobDomain: "SERVICE" }, "VEHICLE")
  };
  assert.equal(cleared.jobDomain, "VEHICLE");
  const params = buildQueueListSearchParams({ ...cleared, query: "", page: 1 });
  assert.equal(params.get("jobDomain"), "VEHICLE");
  assert.equal(params.get("page"), "1");
  assert.equal(params.get("search"), null);
});

test("a one-character search is not sent, and the next page changes the request", () => {
  const first = buildQueueListSearchParams({
    ...DEFAULT_QUEUE_FILTERS,
    ...withLockedJobDomain({ jobDomain: "MACHINERY", query: "p", page: 1 }, "MACHINERY")
  });
  assert.equal(first.get("search"), null);
  assert.equal(first.get("page"), "1");
  const next = buildQueueListSearchParams({
    ...DEFAULT_QUEUE_FILTERS,
    ...withLockedJobDomain({ jobDomain: "MACHINERY", page: 2 }, "MACHINERY")
  });
  assert.notEqual(workOrderQueueRequestKey({ ...DEFAULT_QUEUE_FILTERS, jobDomain: "MACHINERY", page: 1 }), workOrderQueueRequestKey({ ...DEFAULT_QUEUE_FILTERS, jobDomain: "MACHINERY", page: 2 }));
  assert.equal(next.get("page"), "2");
});
