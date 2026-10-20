import { AuditAction } from "@prisma/client";

import { writeAuditTrail } from "./audit-trail.util";
import { PrismaService } from "../../database/prisma.service";

type UserSkillDb = Pick<PrismaService, "userSkill" | "user" | "auditLog">;

async function replaceUserSkills(db: UserSkillDb, userId: string, skills: string[]): Promise<void> {
  const uniqueSkills = [...new Set(skills.map((skill) => skill.trim()).filter(Boolean))];
  const owner = await db.user.findUnique({ where: { id: userId }, select: { tenantId: true } });
  const existing = await db.userSkill.findMany({
    where: { userId },
    select: { id: true, userId: true, skill: true }
  });

  await db.userSkill.deleteMany({ where: { userId } });
  if (uniqueSkills.length > 0) {
    await db.userSkill.createMany({
      data: uniqueSkills.map((skill) => ({ userId, skill }))
    });
  }
  const created =
    uniqueSkills.length > 0
      ? await db.userSkill.findMany({
          where: { userId },
          select: { id: true, userId: true, skill: true }
        })
      : [];

  for (const row of existing) {
    await writeAuditTrail(db, {
      entity: "UserSkill",
      entityId: row.id,
      action: AuditAction.DELETE,
      module: "people",
      tenantId: owner?.tenantId ?? null,
      beforeData: { userId: row.userId, skill: row.skill }
    });
  }
  for (const row of created) {
    await writeAuditTrail(db, {
      entity: "UserSkill",
      entityId: row.id,
      action: AuditAction.CREATE,
      module: "people",
      tenantId: owner?.tenantId ?? null,
      afterData: { userId: row.userId, skill: row.skill }
    });
  }
}

/** Replace UserSkill junction rows (standalone — wraps in $transaction). */
export async function syncUserSkills(
  prisma: PrismaService,
  userId: string,
  skills: string[]
): Promise<void> {
  await prisma.$transaction((tx) => replaceUserSkills(tx, userId, skills));
}

/** Same as syncUserSkills but for an existing Prisma transaction client (no nested $transaction). */
export async function syncUserSkillsTx(
  db: UserSkillDb,
  userId: string,
  skills: string[]
): Promise<void> {
  await replaceUserSkills(db, userId, skills);
}
