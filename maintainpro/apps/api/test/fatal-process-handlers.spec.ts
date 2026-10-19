import {
  handleUncaughtException,
  handleUnhandledRejection,
  registerFatalProcessHandlers,
  resetFatalProcessHandlerRegistrationForTests
} from "../src/bootstrap/fatal-process-handlers";

describe("MP-007: fatal process handlers", () => {
  it("exits on unhandledRejection when not a swallowed Redis bootstrap error", () => {
    const exitProcess = jest.fn();
    const logFatal = jest.fn();

    handleUnhandledRejection(new Error("unexpected boom"), {
      captureBootstrapRedisError: () => false,
      logFatal,
      exitProcess
    });

    expect(logFatal).toHaveBeenCalledWith(expect.stringContaining("fatal_unhandled_rejection"));
    expect(exitProcess).toHaveBeenCalledWith(1);
  });

  it("does not exit when Redis bootstrap capture swallows the rejection", () => {
    const exitProcess = jest.fn();
    handleUnhandledRejection(new Error("Redis ECONNREFUSED"), {
      captureBootstrapRedisError: () => true,
      logFatal: jest.fn(),
      exitProcess
    });
    expect(exitProcess).not.toHaveBeenCalled();
  });

  it("exits on uncaughtException when not Redis bootstrap noise", () => {
    const exitProcess = jest.fn();
    handleUncaughtException(new Error("corrupt state"), {
      captureBootstrapRedisError: () => false,
      logFatal: jest.fn(),
      exitProcess
    });
    expect(exitProcess).toHaveBeenCalledWith(1);
  });

  it("includes the active request id in fatal log lines", () => {
    const logFatal = jest.fn();
    const handlers = {
      captureBootstrapRedisError: () => false,
      logFatal,
      exitProcess: jest.fn(),
      getRequestId: () => "req-abc-123"
    };
    handleUnhandledRejection(new Error("boom"), handlers);
    handleUncaughtException(new Error("boom"), handlers);
    expect(logFatal).toHaveBeenNthCalledWith(1, expect.stringContaining("requestId=req-abc-123"));
    expect(logFatal).toHaveBeenNthCalledWith(2, expect.stringContaining("requestId=req-abc-123"));
  });

  it("logs requestId=none outside a request", () => {
    const logFatal = jest.fn();
    handleUncaughtException(new Error("boom"), {
      captureBootstrapRedisError: () => false,
      logFatal,
      exitProcess: jest.fn()
    });
    expect(logFatal).toHaveBeenCalledWith(expect.stringContaining("requestId=none"));
  });

  it("registers fatal listeners only once", () => {
    const fakeProcess = {
      on: jest.fn()
    } as unknown as NodeJS.Process;

    resetFatalProcessHandlerRegistrationForTests(fakeProcess);
    const handlers = {
      captureBootstrapRedisError: () => false,
      logFatal: jest.fn(),
      exitProcess: jest.fn()
    };

    registerFatalProcessHandlers(handlers, fakeProcess);
    registerFatalProcessHandlers(handlers, fakeProcess);

    expect(fakeProcess.on).toHaveBeenCalledTimes(2);
    expect(fakeProcess.on).toHaveBeenCalledWith("unhandledRejection", expect.any(Function));
    expect(fakeProcess.on).toHaveBeenCalledWith("uncaughtException", expect.any(Function));
  });
});
