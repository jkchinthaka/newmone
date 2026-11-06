export type TaskStatus = "NOT_STARTED" | "WORKING" | "DONE";

export type JobTask = {
  id: string;
  title: string;
  status: TaskStatus;
  sortOrder: number;
  estimatedHours: number | null;
  startedAt: string | null;
  completedAt: string | null;
  timeSpentMinutes: number | null;
  assignees: Array<{ employeeId: string; fullName: string }>;
  isMine: boolean;
};

export type JobTaskList = { tasks: JobTask[]; done: number; total: number };

const MANAGER_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER"]);

export function canManageJobTasks(role?: string | null): boolean {
  return role ? MANAGER_ROLES.has(role) : false;
}

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  NOT_STARTED: "Not started",
  WORKING: "Working",
  DONE: "Done"
};

export function formatTaskTime(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "—";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function taskProgressLabel(list: Pick<JobTaskList, "done" | "total">): string {
  return list.total === 0 ? "No tasks" : `${list.done}/${list.total} done`;
}
