import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const cols = await prisma.$queryRawUnsafe(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'WorkOrder'
      AND COLUMN_NAME IN (
        'functionalTestResult',
        'roadTestResult',
        'completionMeterReading',
        'operatingRestriction',
        'productionImpact'
      )
    ORDER BY COLUMN_NAME
  `);
  console.log("D3-D5 columns:", JSON.stringify(cols));

  const counts = await prisma.workOrder.groupBy({
    by: ["jobDomain"],
    _count: true
  });
  console.log("jobDomain counts:", JSON.stringify(counts));

  const sample = await prisma.workOrder.findFirst({
    where: { jobDomain: { in: ["MACHINERY", "SERVICE", "VEHICLE"] } },
    select: {
      id: true,
      woNumber: true,
      jobDomain: true,
      assetId: true,
      vehicleId: true,
      functionalLocationId: true,
      functionalTestResult: true,
      roadTestResult: true,
      completionMeterReading: true,
      temporaryRepair: true,
      operatingRestriction: true,
      status: true
    },
    orderBy: { updatedAt: "desc" }
  });
  console.log("Sample domain WO:", JSON.stringify(sample));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
