import type { Employee, Prisma, PrismaClient } from "@prisma/client";

export type WorkforceSeedMatch = {
  linkedUserId?: string;
  employeeNo?: string;
  email?: string | null;
};

export type WorkforceSeedLinkedInput = {
  tenantId: string;
  employeeNo: string;
  fullName: string;
  email: string;
  phone?: string | null;
  departmentId?: string | null;
  branchName?: string;
  designation: string;
  skills: string[];
  dailyCapacityHours: number;
  active: boolean;
  linkedUserId: string;
};

export type WorkforceSeedWorkforceOnlyInput = {
  tenantId: string;
  employeeNo: string;
  fullName: string;
  designation: string;
  skills: string[];
  dailyCapacityHours: number;
  active: boolean;
  canLogin: false;
  branchName?: string;
  departmentId?: string | null;
};

export function pickWorkforceEmployeeMatch(
  matches: Employee[],
  match: WorkforceSeedMatch
): Employee | null {
  if (matches.length === 0) {
    return null;
  }

  if (match.linkedUserId) {
    const linkedMatch = matches.find((row) => row.linkedUserId === match.linkedUserId);
    if (linkedMatch) {
      return linkedMatch;
    }
  }

  if (match.employeeNo) {
    const employeeNoMatch = matches.find((row) => row.employeeNo === match.employeeNo);
    if (employeeNoMatch) {
      return employeeNoMatch;
    }
  }

  if (match.email?.trim()) {
    const email = match.email.trim().toLowerCase();
    const emailMatch = matches.find((row) => row.email?.toLowerCase() === email);
    if (emailMatch) {
      return emailMatch;
    }
  }

  return matches[0] ?? null;
}

export async function findExistingWorkforceEmployee(
  prisma: PrismaClient,
  tenantId: string,
  match: WorkforceSeedMatch
): Promise<Employee | null> {
  if (match.linkedUserId) {
    const byLinkedUser = await prisma.employee.findFirst({
      where: { linkedUserId: match.linkedUserId }
    });
    if (byLinkedUser) {
      return byLinkedUser;
    }
  }

  const or: Prisma.EmployeeWhereInput[] = [];

  if (match.employeeNo) {
    or.push({ tenantId, employeeNo: match.employeeNo });
  }
  if (match.email?.trim()) {
    or.push({ email: match.email.trim().toLowerCase() });
  }

  if (or.length === 0) {
    return null;
  }

  const matches = await prisma.employee.findMany({
    where: { OR: or },
    orderBy: { updatedAt: "desc" }
  });

  return pickWorkforceEmployeeMatch(matches, match);
}

export async function normalizeWorkforceOnlyLinkedUserIds(prisma: PrismaClient, tenantId: string) {
  const rows = await prisma.employee.findMany({
    where: {
      tenantId,
      canLogin: false,
      linkedUserId: null
    },
    select: { id: true }
  });

  for (const row of rows) {
    await prisma.$runCommandRaw({
      update: "Employee",
      updates: [
        {
          q: { _id: { $oid: row.id } },
          u: { $unset: { linkedUserId: "" } },
          multi: false
        }
      ]
    });
  }
}

export async function upsertLinkedWorkforceEmployee(
  prisma: PrismaClient,
  input: WorkforceSeedLinkedInput
) {
  const existing = await findExistingWorkforceEmployee(prisma, input.tenantId, {
    linkedUserId: input.linkedUserId,
    employeeNo: input.employeeNo,
    email: input.email
  });

  const data: Prisma.EmployeeUncheckedUpdateInput = {
    employeeNo: input.employeeNo,
    fullName: input.fullName,
    email: input.email,
    phone: input.phone ?? null,
    departmentId: input.departmentId ?? null,
    branchName: input.branchName ?? "Main Site",
    designation: input.designation,
    skills: input.skills,
    dailyCapacityHours: input.dailyCapacityHours,
    active: input.active,
    canLogin: true,
    linkedUserId: input.linkedUserId
  };

  if (existing) {
    return prisma.employee.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.employee.create({
    data: {
      tenantId: input.tenantId,
      ...data
    } as Prisma.EmployeeUncheckedCreateInput
  });
}

export async function upsertWorkforceOnlyEmployee(
  prisma: PrismaClient,
  input: WorkforceSeedWorkforceOnlyInput
) {
  const existing = await findExistingWorkforceEmployee(prisma, input.tenantId, {
    employeeNo: input.employeeNo
  });

  const data: Prisma.EmployeeUncheckedUpdateInput = {
    employeeNo: input.employeeNo,
    fullName: input.fullName,
    designation: input.designation,
    skills: input.skills,
    dailyCapacityHours: input.dailyCapacityHours,
    active: input.active,
    canLogin: false,
    branchName: input.branchName ?? "Main Site",
    departmentId: input.departmentId ?? null
  };

  if (existing) {
    return prisma.employee.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.employee.create({
    data: {
      tenantId: input.tenantId,
      ...data
    } as Prisma.EmployeeUncheckedCreateInput
  });
}
