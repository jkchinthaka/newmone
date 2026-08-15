import { sanitizeErrorForLog } from "../common/logging/sanitize-for-log.util";

export type FatalProcessHandlers = {
  captureBootstrapRedisError: (origin: string, error: unknown) => boolean;
  logFatal: (line: string) => void;
  exitProcess: (code: number) => void;
};

const HANDLER_FLAG = Symbol.for("maintainpro.fatalProcessHandlersRegistered");

/**
 * Shared fatal-process policy for Nest bootstrap.
 * Redis bootstrap noise is swallowed; all other fatal events fail-fast.
 */
export function handleUnhandledRejection(
  reason: unknown,
  handlers: FatalProcessHandlers
): void {
  if (handlers.captureBootstrapRedisError("unhandledRejection", reason)) {
    return;
  }
  const safe = sanitizeErrorForLog(reason);
  handlers.logFatal(
    `[bootstrap] fatal_unhandled_rejection category=${safe.errorCategory} ${safe.messageSafe}`
  );
  handlers.exitProcess(1);
}

export function handleUncaughtException(err: Error, handlers: FatalProcessHandlers): void {
  if (handlers.captureBootstrapRedisError("uncaughtException", err)) {
    return;
  }
  const safe = sanitizeErrorForLog(err);
  handlers.logFatal(
    `[bootstrap] fatal_uncaught_exception category=${safe.errorCategory} ${safe.messageSafe}`
  );
  handlers.exitProcess(1);
}

/** Idempotent registration so hot-reload / double bootstrap does not stack listeners. */
export function registerFatalProcessHandlers(
  handlers: FatalProcessHandlers,
  processRef: NodeJS.Process = process
): void {
  const flagged = processRef as NodeJS.Process & { [HANDLER_FLAG]?: boolean };
  if (flagged[HANDLER_FLAG]) {
    return;
  }
  flagged[HANDLER_FLAG] = true;

  processRef.on("unhandledRejection", (reason: unknown) => {
    handleUnhandledRejection(reason, handlers);
  });
  processRef.on("uncaughtException", (err: Error) => {
    handleUncaughtException(err, handlers);
  });
}

/** Test-only: clear registration flag (does not remove live listeners). */
export function resetFatalProcessHandlerRegistrationForTests(
  processRef: NodeJS.Process = process
): void {
  const flagged = processRef as NodeJS.Process & { [HANDLER_FLAG]?: boolean };
  delete flagged[HANDLER_FLAG];
}
