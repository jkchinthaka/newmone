import { AssetsService, assetTagTypeCode } from "../src/modules/assets/assets.service";
import { isValidAssetTag } from "../src/modules/assets/dto/asset-tag";

describe("asset register flow", () => {
  it("maps asset types to tag codes", () => {
    expect(assetTagTypeCode("MACHINE")).toBe("MCH");
    expect(assetTagTypeCode("infrastructure")).toBe("BLD");
    expect(assetTagTypeCode("IRRIGATION_PUMP")).toBe("IRR");
    expect(assetTagTypeCode(undefined)).toBe("AST");
  });

  it("suggests the next free tag in the AST- format", async () => {
    const prisma = {
      asset: {
        findMany: jest.fn().mockResolvedValue([{ assetTag: "AST-MCH0001" }, { assetTag: "AST-MCH0007" }, { assetTag: "AST-MCHX9" }])
      }
    };
    const service = new AssetsService(prisma as never, {} as never, {} as never, {} as never);
    const { assetTag } = await service.suggestNextAssetTag("tenant-1", "MACHINE");
    expect(assetTag).toBe("AST-MCH0008");
    expect(isValidAssetTag(assetTag)).toBe(true);
    expect(prisma.asset.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: "tenant-1", assetTag: { startsWith: "AST-MCH" } } }));
  });
});
