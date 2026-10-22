import { BadRequestException } from "@nestjs/common";
import { RoleName } from "@prisma/client";

export const LAST_TENANT_SUPER_ADMIN_MESSAGE =
  "The last active super admin in this tenant cannot be demoted, deactivated, or deleted";

type SuperAdminSubject = {
  id: string;
  tenantId: string | null;
  isActive: boolean;
  role: { name: string };
};

type Counter = {
  count: (args: { where: Record<string, unknown> }) => Promise<number>;
};

export async function assertLoadedSuperAdminCanChange(
  prisma: { user: Counter },
  user: SuperAdminSubject,
  change: { deleting?: boolean; nextIsActive?: boolean; nextRoleName?: string | null }
): Promise<void> {
  if (!user.isActive || user.role.name !== RoleName.SUPER_ADMIN) {
    return;
  }

  const demoting = change.nextRoleName != null && change.nextRoleName !== RoleName.SUPER_ADMIN;
  const deactivating = change.nextIsActive === false;
  const deleting = change.deleting === true;
  if (!demoting && !deactivating && !deleting) {
    return;
  }

  const activeInTenant = await prisma.user.count({
    where: {
      isActive: true,
      tenantId: user.tenantId,
      role: { name: RoleName.SUPER_ADMIN }
    }
  });

  if (activeInTenant <= 1) {
    throw new BadRequestException(LAST_TENANT_SUPER_ADMIN_MESSAGE);
  }
}
