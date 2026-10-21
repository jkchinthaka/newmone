import { isSqlServerConflictError, withSqlConflictRetry } from "../src/common/utils/sql-conflict-retry";

describe("SQL Server conflict retry", () => {
  const sleep = async () => undefined;

  it("retries deadlock 1205 and snapshot conflict 3960, then gives up", async () => {
    const deadlock = Object.assign(new Error("deadlock victim"), { number: 1205 });
    const snapshot = Object.assign(new Error("write conflict"), { number: 3960 });
    const run = jest
      .fn()
      .mockRejectedValueOnce(deadlock)
      .mockRejectedValueOnce(snapshot)
      .mockResolvedValueOnce("assigned");

    await expect(withSqlConflictRetry(run, sleep)).resolves.toBe("assigned");
    expect(run).toHaveBeenCalledTimes(3);
  });

  it("retries Prisma P2034 and a nested 1205 cause", async () => {
    const wrapped = Object.assign(new Error("Transaction failed due to a write conflict or a deadlock. Please retry your transaction"), {
      code: "P2034"
    });
    const nested = new Error("outer");
    (nested as Error & { cause: Error }).cause = Object.assign(new Error("snapshot"), { number: 1205 });
    const run = jest.fn().mockRejectedValueOnce(wrapped).mockRejectedValueOnce(nested).mockResolvedValueOnce("ok");

    await expect(withSqlConflictRetry(run, sleep)).resolves.toBe("ok");
    expect(run).toHaveBeenCalledTimes(3);
  });

  it("does not retry a constraint failure or a version conflict", async () => {
    const constraint = Object.assign(new Error("FK conflict"), { number: 547, code: "P2003" });
    const run = jest.fn().mockRejectedValue(constraint);

    await expect(withSqlConflictRetry(run, sleep)).rejects.toBe(constraint);
    expect(run).toHaveBeenCalledTimes(1);
    expect(isSqlServerConflictError(new Error("Work order was updated by someone else. Refresh and retry."))).toBe(false);
  });

  it("stops after three attempts", async () => {
    const deadlock = Object.assign(new Error("deadlock"), { number: 1205 });
    const run = jest.fn().mockRejectedValue(deadlock);

    await expect(withSqlConflictRetry(run, sleep)).rejects.toBe(deadlock);
    expect(run).toHaveBeenCalledTimes(3);
  });
});
