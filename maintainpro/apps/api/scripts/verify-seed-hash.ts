import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

async function main() {
  const password = (process.env.MAINTAINPRO_SEED_PASSWORD ?? "").trim();
  if (!password) {
    throw new Error("MAINTAINPRO_SEED_PASSWORD is required");
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({
      where: { email: "superadmin@maintainpro.local" },
      select: { id: true, isActive: true, passwordHash: true },
    });
    if (!user) {
      console.log(JSON.stringify({ ok: false, reason: "user_missing" }));
      return;
    }
    const match = await bcrypt.compare(password, user.passwordHash);
    console.log(
      JSON.stringify({
        ok: match && user.isActive,
        userFound: true,
        isActive: user.isActive,
        passwordMatch: match,
        passwordLength: password.length,
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
