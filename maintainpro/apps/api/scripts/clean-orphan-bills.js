const { PrismaClient } = require('@prisma/client');
(async () => {
  const p = new PrismaClient();
  try {
    const meters = await p.utilityMeter.findMany({ select: { id: true } });
    const ids = new Set(meters.map((m) => m.id));
    const bills = await p.utilityBill.findMany({ select: { id: true, meterId: true } });
    const orphans = bills.filter((b) => !ids.has(b.meterId));
    console.log('total bills:', bills.length, 'orphans:', orphans.length);
    if (orphans.length) {
      const r = await p.utilityBill.deleteMany({ where: { id: { in: orphans.map((o) => o.id) } } });
      console.log('deleted:', r.count);
    }
  } finally {
    await p.$disconnect();
  }
})();
