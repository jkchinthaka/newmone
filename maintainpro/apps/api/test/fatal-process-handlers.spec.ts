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
