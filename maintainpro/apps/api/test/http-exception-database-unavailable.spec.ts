import { ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common";

import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";

describe("HttpExceptionFilter (MP-008 + DATABASE_UNAVAILABLE)", () => {
  const filter = new HttpExceptionFilter();

  function runFilter(exception: unknown, requestId?: string) {
    const json = jest.fn();
    const setHeader = jest.fn();
    const status = jest.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({
          status,
          json,
          getHeader: jest.fn(),
          setHeader
        }),
        getRequest: () => ({
          method: "GET",
          url: "/api/work-orders",
          requestId
        })
      })
    } as unknown as ArgumentsHost;

    filter.catch(exception, host);

    return { status, json, setHeader };
  }

  it("maps Prisma connection failures to controlled DATABASE_UNAVAILABLE 503", () => {
    const { status, json } = runFilter(
      new Error("PrismaClientInitializationError: Server selection timed out")
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "DATABASE_UNAVAILABLE",
          message: "Database unavailable. Please retry later."
        })
      })
    );
  });

  it("does not remap regular HttpException 4xx responses", () => {
    const { status, json } = runFilter(new HttpException("Forbidden", HttpStatus.FORBIDDEN));

    expect(status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: "PERMISSION_DENIED",
          message: "Forbidden"
        })
      })
    );
  });

  it("MP-008: does not leak raw Error.message for unexpected 5xx", () => {
    const { status, json } = runFilter(
      new Error("Secret API token sk_live_abc123 leaked from StockService.allocate")
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
          details: []
        })
      })
    );
    expect(JSON.stringify(json.mock.calls[0][0])).not.toMatch(/sk_live_abc123|StockService\.allocate/i);
  });

  it("MP-008: sanitizes HttpException 500 carrying sensitive-looking internal text", () => {
    const { status, json } = runFilter(
      new HttpException(
        "ENOENT: /var/data/secrets.env mongodb://user:pass@host/db",
        HttpStatus.INTERNAL_SERVER_ERROR
      )
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = json.mock.calls[0][0] as { error: { message: string; details: unknown } };
    expect(body.error.message).toBe("An unexpected error occurred");
    expect(JSON.stringify(body)).not.toMatch(/mongodb:\/\/|secrets\.env|ENOENT/i);
  });

  it("MP-008: preserves intentional 4xx business messages", () => {
    const { status, json } = runFilter(
      new HttpException("Asset tag must be unique", HttpStatus.BAD_REQUEST)
    );
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: "Asset tag must be unique"
        })
      })
    );
  });

  it("MP-008: preserves requestId on error responses", () => {
    const { json, setHeader } = runFilter(new Error("boom"), "req-abc-123");
    expect(setHeader).toHaveBeenCalledWith("X-Request-Id", "req-abc-123");
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          requestId: "req-abc-123"
        })
      })
    );
  });
});
