import { randomUUID } from "node:crypto";

export interface WorkOrder {
  id: string;
  title: string;
  description: string;
  assetCode: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "completed";
  dueDate: string;
}

const workOrders: WorkOrder[] = [
  {
    id: "wo-001",
    title: "Inspect pressure valves",
    description: "Monthly inspection for boiler pressure valves.",
    assetCode: "PUMP-101",
    priority: "high",
    status: "open",
    dueDate: "2026-04-28"
  }
];

export const workOrdersService = {
  listWorkOrders(): WorkOrder[] {
    return workOrders;
  },

  createWorkOrder(input: Omit<WorkOrder, "id" | "status">): WorkOrder {
    const created: WorkOrder = {
      id: randomUUID(),
      status: "open",
      ...input
    };

    workOrders.push(created);
    return created;
  }
};
