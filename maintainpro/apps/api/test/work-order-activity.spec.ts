import {
  buildFacilityIssueDetailHref,
  formatLinkedFacilityIssueLocation,
  mapWorkOrderActivityToEvidenceTimeline,
  shouldShowLinkedFacilityIssueSummary,
  type WorkOrderActivityEntry,
  type WorkOrderLinkedFacilityIssueSummary,
  workOrderActivityAllowsContinueWhenUnavailable,
  workOrderActivityHasUploadActions,
  workOrderActivityUnavailableMessage
} from "../../web/lib/work-order-activity";

describe("work order activity helpers", () => {
  const sampleEntries: WorkOrderActivityEntry[] = [
    {
      id: "wo-1-issue-reported",
      type: "facility_issue_reported",
      label: "Facility issue reported",
      description: "Restroom leak",
      timestamp: "2026-06-10T07:30:00.000Z",
      actorName: "Jamie Cleaner",
      severity: "HIGH",
      status: "OPEN",
      category: "PLUMBING",
      source: "facility_issue",
      relatedId: "issue-1",
      relatedLabel: "Restroom leak"
    },
    {
      id: "wo-1-created",
      type: "work_order_created",
      label: "Work order created",
      description: "Work order WO-2026-0001 created.",
      timestamp: "2026-06-10T08:00:00.000Z",
      actorName: "Alex Admin",
      severity: null,
      status: "OPEN",
      category: null,
      source: "work_order",
      relatedId: "wo-1",
      relatedLabel: "WO-2026-0001"
    },
    {
      id: "wo-1-started",
      type: "work_started",
      label: "Work started",
      description: "Work started by Taylor Tech.",
      timestamp: "2026-06-10T09:00:00.000Z",
      actorName: "Taylor Tech",
      severity: null,
      status: "IN_PROGRESS",
      category: null,
      source: "work_order",
      relatedId: "wo-1",
      relatedLabel: "WO-2026-0001"
    }
  ];

  it("maps activity entries to sorted EvidenceTimeline events", () => {
    const events = mapWorkOrderActivityToEvidenceTimeline([...sampleEntries].reverse());

    expect(events.map((event) => event.id)).toEqual(sampleEntries.map((entry) => entry.id));
    expect(events[0].type).toBe("reported");
    expect(events[2].type).toBe("started");
    expect(events[2].actorName).toBe("Taylor Tech");
  });

  it("formats linked facility issue summary safely", () => {
    const issue: WorkOrderLinkedFacilityIssueSummary = {
      id: "issue-1",
      title: "Restroom leak",
      descriptionPreview: "Water pooling near sink",
      category: "PLUMBING",
      severity: "HIGH",
      status: "IN_PROGRESS",
      roomName: "Room 101",
      locationName: "North Wing",
      reportedAt: "2026-06-10T07:30:00.000Z"
    };

    expect(shouldShowLinkedFacilityIssueSummary(issue)).toBe(true);
    expect(formatLinkedFacilityIssueLocation(issue)).toBe("Room 101 · North Wing");
    expect(buildFacilityIssueDetailHref(issue.id)).toBe("/cleaning/issues?issueId=issue-1");
  });

  it("does not expose upload actions and allows continue when unavailable", () => {
    expect(workOrderActivityHasUploadActions()).toBe(false);
    expect(workOrderActivityAllowsContinueWhenUnavailable()).toBe(true);
    expect(workOrderActivityUnavailableMessage()).toContain("remain available");
  });
});
