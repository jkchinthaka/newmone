import { assertDisposableSqlServer, deleteDisposableTenants } from "./disposable-tenant-cleanup";

function client(name: string) {
  return {
    $queryRaw: jest.fn().mockResolvedValue([{ name }]),
    $transaction: jest.fn(),
    $executeRawUnsafe: jest.fn()
  };
}

describe("disposable cleanup guard", () => {
  it("allows only maintainpro_e2e_* databases", async () => {
    await expect(assertDisposableSqlServer(client("maintainpro_e2e_wo_verify") as never)).resolves.toBe(
      "maintainpro_e2e_wo_verify"
    );
    for (const name of ["MaintainProDev", "nelna", "MaintainProProd", "maintainpro_e2e_nelna", ""]) {
      await expect(assertDisposableSqlServer(client(name) as never)).rejects.toThrow("Refusing cleanup");
    }
  });

  it("never opens a transaction or touches the AuditLog trigger on a non-disposable database", async () => {
    const prisma = client("MaintainProDev");
    await expect(deleteDisposableTenants(prisma as never, ["tenant1"])).rejects.toThrow("Refusing cleanup");
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });
});
