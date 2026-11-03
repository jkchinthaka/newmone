import { cleanLogText, clientErrorLine } from "../src/modules/client-errors/client-errors.controller";

describe("client error log line", () => {
  it("keeps only safe fields on one line", () => {
    const line = clientErrorLine(
      { sub: "u1", tenantId: "t1", role: "MANAGER" } as never,
      { source: "route error boundary", name: "TypeError", digest: "abc123", route: "/work-orders/:id" }
    );
    expect(line).toBe(
      'client-error tenant=t1 user=u1 role=MANAGER source="route error boundary" error=TypeError digest=abc123 route=/work-orders/:id'
    );
  });

  it("cannot forge extra log lines and caps long text", () => {
    expect(cleanLogText("a\nclient-error user=admin\r\nb")).toBe("a client-error user=admin b");
    expect(cleanLogText("x".repeat(500), 50)).toHaveLength(50);
    expect(cleanLogText(undefined)).toBe("");
  });
});
