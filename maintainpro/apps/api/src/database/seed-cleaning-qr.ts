import { PrismaClient, RoleName } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const cleaningLocations = [
  {
    qrCode: "06b558d1-3352-4924-ae6c-f8df06cdf7cf",
    name: "Ground Floor - Male Toilet",
    area: "Lobby Wing",
    building: "Main Building",
    floor: "Ground",
    description: "Primary public restroom near reception"
  },
  {
    qrCode: "e55f9ed2-90d4-4c17-ac4b-cf8599fc6faa",
    name: "First Floor - Female Toilet",
    area: "Admin Wing",
    building: "Main Building",
    floor: "First",
    description: "Executive office washroom"
  },
  {
    qrCode: "5f2032a1-7c6f-43f1-a9c9-bec5ef0e6287",
    name: "Warehouse - Staff Washroom",
    area: "Warehouse",
    building: "Operations Block",
    floor: "Ground",
    description: "Staff washroom beside the loading bay"
  }
];

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: "default" }
  });

  if (!tenant) {
    throw new Error("Default tenant not found. Run the base seed first.");
  }

  const supervisorRole = await prisma.role.findUnique({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: RoleName.SUPERVISOR
      }
    }
  });

  const cleanerRole = await prisma.role.findUnique({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: RoleName.CLEANER
      }
    }
  });

  if (!supervisorRole || !cleanerRole) {
    throw new Error("Required cleaning roles are missing. Re-run the base seed first.");
  }

  const passwordHash = await bcrypt.hash("Admin@1234", 12);

  await prisma.user.upsert({
    where: { email: "supervisor@maintainpro.local" },
    update: {
      firstName: "Cleaning",
      lastName: "Supervisor",
      roleId: supervisorRole.id,
      tenantId: tenant.id,
      passwordHash,
      isActive: true
    },
    create: {
      email: "supervisor@maintainpro.local",
      firstName: "Cleaning",
      lastName: "Supervisor",
      roleId: supervisorRole.id,
      tenantId: tenant.id,
      passwordHash,
      isActive: true
    }
  });

  await prisma.user.upsert({
    where: { email: "cleaner@maintainpro.local" },
    update: {
      firstName: "Kamal",
      lastName: "Perera",
      roleId: cleanerRole.id,
      tenantId: tenant.id,
      passwordHash,
      isActive: true
    },
    create: {
      email: "cleaner@maintainpro.local",
      firstName: "Kamal",
      lastName: "Perera",
      roleId: cleanerRole.id,
      tenantId: tenant.id,
      passwordHash,
      isActive: true
    }
  });

  const frontendUrl = (process.env.FRONTEND_URL ?? "http://localhost:3001").replace(/\/$/, "");

  for (const location of cleaningLocations) {
    const scanUrl = `${frontendUrl}/cleaning/scan?code=${location.qrCode}`;

    await prisma.cleaningLocation.upsert({
      where: { qrCode: location.qrCode },
      update: {
        tenantId: tenant.id,
        name: location.name,
        area: location.area,
        building: location.building,
        floor: location.floor,
        description: location.description,
        qrCodeUrl: scanUrl,
        isActive: true
      },
      create: {
        tenantId: tenant.id,
        name: location.name,
        area: location.area,
        building: location.building,
        floor: location.floor,
        description: location.description,
        qrCode: location.qrCode,
        qrCodeUrl: scanUrl,
        isActive: true
      }
    });
  }

  console.log("Cleaning QR sample data upserted successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });