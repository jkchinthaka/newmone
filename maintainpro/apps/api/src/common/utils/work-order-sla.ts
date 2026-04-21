import { Priority } from "@prisma/client";

const slaHoursMap: Record<Priority, number> = {
  LOW: 168,
  MEDIUM: 72,
  HIGH: 24,
  CRITICAL: 4
};

export const calculateSlaDeadline = (priority: Priority, startDate: Date): Date => {
  const hours = slaHoursMap[priority];
  return new Date(startDate.getTime() + hours * 60 * 60 * 1000);
};

export const isSlaBreached = (deadline: Date, completedAt: Date): boolean => {
  return completedAt.getTime() > deadline.getTime();
};
