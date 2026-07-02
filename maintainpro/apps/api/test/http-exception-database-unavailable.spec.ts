import { ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common";

import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";

describe("HttpExceptionFilter DATABASE_UNAVAILABLE", () => {
  const filter = new HttpExceptionFilter();

  function runFilter(exception: unknown) {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status, json }),
        getRequest: () => ({ method: "GET", url: "/api/work-orders" })
      })
    } as unknown as ArgumentsHost;

    filter.catch(exception, host);

    return { status, json };
  }

  it("maps Prisma connection failures to controlled DATABASE_UNAVAILABLE 503", () => {
    const { status, json } = runFilter(new Error("PrismaClientInitializationError: Server selection timed out"));

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

  it("does not remap regular HttpException responses", () => {
    const { status, json } = runFilter(new HttpException("Forbidden", HttpStatus.FORBIDDEN));

    expect(status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: "HTTP_ERROR",
          message: "Forbidden"
        })
      })
    );
  });
});
