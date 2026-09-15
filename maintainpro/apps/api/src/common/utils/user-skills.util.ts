import { PrismaService } from "../../database/prisma.service";

type UserSkillDb = Pick<PrismaService, "userSkill">;

async function replaceUserSkills(db: UserSkillDb, userId: string, skills: string[]): Promise<void> {
  const uniqueSkills = [...new Set(skills.map((skill) => skill.trim()).filter(Boolean))];

  await db.userSkill.deleteMany({ where: { userId } });
  if (uniqueSkills.length > 0) {
    await db.userSkill.createMany({
      data: uniqueSkills.map((skill) => ({ userId, skill }))
    });
  }
}

/** Replace UserSkill junction rows (standalone — wraps in $transaction). */
export async function syncUserSkills(
  prisma: Pick<PrismaService, "$transaction" | "userSkill">,
  userId: string,
  skills: string[]
): Promise<void> {
  const uniqueSkills = [...new Set(skills.map((skill) => skill.trim()).filter(Boolean))];

  await prisma.$transaction([
    prisma.userSkill.deleteMany({ where: { userId } }),
    ...(uniqueSkills.length > 0
      ? [
          prisma.userSkill.createMany({
            data: uniqueSkills.map((skill) => ({ userId, skill }))
          })
        ]
      : [])
  ]);
}

/** Same as syncUserSkills but for an existing Prisma transaction client (no nested $transaction). */
export async function syncUserSkillsTx(
  db: UserSkillDb,
  userId: string,
  skills: string[]
): Promise<void> {
  await replaceUserSkills(db, userId, skills);
}
