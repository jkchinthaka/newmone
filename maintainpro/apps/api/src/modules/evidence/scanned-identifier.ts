type IdentifierDb = {
  asset: {
    findFirst: (args: {
      where: { id: string; tenantId: string; OR: Array<Record<string, string>> };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
  vehicle: {
    findFirst: (args: {
      where: { id: string; tenantId: string; OR: Array<Record<string, string>> };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
};

export async function scannedValueMatchesAsset(
  db: IdentifierDb,
  tenantId: string | null | undefined,
  assetId: string | null,
  scanned: string | null
) {
  if (!tenantId || !assetId || !scanned) return false;
  if (scanned === assetId) return true;
  const asset = await db.asset.findFirst({
    where: { id: assetId, tenantId, OR: [{ assetTag: scanned }, { serialNumber: scanned }] },
    select: { id: true }
  });
  return Boolean(asset);
}

export async function scannedValueMatchesVehicle(
  db: IdentifierDb,
  tenantId: string | null | undefined,
  vehicleId: string | null,
  scanned: string | null
) {
  if (!tenantId || !vehicleId || !scanned) return false;
  if (scanned === vehicleId) return true;
  const vehicle = await db.vehicle.findFirst({
    where: { id: vehicleId, tenantId, OR: [{ registrationNo: scanned }, { assetTag: scanned }] },
    select: { id: true }
  });
  return Boolean(vehicle);
}
