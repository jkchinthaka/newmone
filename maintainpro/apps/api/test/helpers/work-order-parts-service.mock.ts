export function createWorkOrderPartsServiceMock() {
  return {
    assertWorkOrderForParts: jest.fn().mockResolvedValue({ id: "wo-1", status: "IN_PROGRESS" }),
    assertStorekeeperCanIssue: jest.fn(),
    createRequestedLine: jest.fn().mockResolvedValue({ id: "line-1" }),
    syncApprovedLine: jest.fn().mockResolvedValue({ id: "line-1" }),
    syncRejectedLine: jest.fn().mockResolvedValue({ id: "line-1" }),
    syncIssuedLine: jest.fn().mockResolvedValue({ id: "line-1" }),
    listLines: jest.fn().mockResolvedValue([]),
    getCostSummary: jest.fn().mockResolvedValue({ netPartCost: 0 }),
    markUsed: jest.fn(),
    requestReturn: jest.fn(),
    confirmReturn: jest.fn(),
    getPartsExceptions: jest.fn().mockResolvedValue({})
  };
}
