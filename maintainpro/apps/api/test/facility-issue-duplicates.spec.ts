import {
  buildDuplicateFacilityIssueCheckPayload,
  duplicateCheckPayloadIncludesTenantId,
  duplicateCheckPayloadUsesAllowedKeysOnly,
  duplicateIssueAllowsContinueDespiteWarning,
  duplicateIssueCheckUnavailableMessage,
  duplicateIssueConfidenceTone,
  duplicateIssueWarningHeadline,
  formatDuplicateIssueConfidenceLabel,
  shouldShowDuplicateIssueWarning
} from "../../web/lib/facility-issue-duplicates";

describe("facility issue duplicate helpers", () => {
  it("builds duplicate-check payload without tenantId", () => {
    const payload = buildDuplicateFacilityIssueCheckPayload({
      title: "Restroom leak",
      description: "Water pooling near sink",
      severity: "HIGH",
      roomId: "room-a",
      category: "plumbing"
    });

    expect(payload).toEqual({
      title: "Restroom leak",
      description: "Water pooling near sink",
      severity: "HIGH",
      roomId: "room-a",
      category: "PLUMBING"
    });
    expect(duplicateCheckPayloadIncludesTenantId(payload)).toBe(false);
    expect(duplicateCheckPayloadUsesAllowedKeysOnly(payload)).toBe(true);
  });

  it("formats confidence labels and tones", () => {
    expect(formatDuplicateIssueConfidenceLabel("HIGH")).toBe("High confidence");
    expect(duplicateIssueConfidenceTone("HIGH")).toBe("danger");
    expect(duplicateIssueConfidenceTone("MEDIUM")).toBe("warning");
    expect(duplicateIssueConfidenceTone("LOW")).toBe("info");
  });

  it("shows warning only when candidates exist and allows continue", () => {
    expect(shouldShowDuplicateIssueWarning([])).toBe(false);
    expect(
      shouldShowDuplicateIssueWarning([
        {
          id: "issue-1",
          title: "Leak",
          descriptionPreview: "Water near sink",
          status: "OPEN",
          category: "PLUMBING",
          severity: "HIGH",
          roomName: "Room 101",
          locationName: null,
          createdAt: "2026-06-10T10:00:00.000Z",
          workOrderId: null,
          confidence: "HIGH",
          reason: "Similar text"
        }
      ])
    ).toBe(true);
    expect(duplicateIssueAllowsContinueDespiteWarning()).toBe(true);
    expect(duplicateIssueWarningHeadline(2)).toBe("2 possible duplicate issues found");
    expect(duplicateIssueCheckUnavailableMessage()).toContain("still submit");
  });
});
