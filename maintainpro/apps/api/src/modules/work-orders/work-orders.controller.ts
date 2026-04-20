import type { RequestHandler } from "express";
import { z } from "zod";

import { sendSuccess } from "../../common/utils/response";
import { workOrdersService } from "./work-orders.service";

const createWorkOrderSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(5),
  assetCode: z.string().min(2),
  priority: z.enum(["low", "medium", "high", "critical"]),
  dueDate: z.string().date()
});

const list: RequestHandler = (_req, res) => {
  return sendSuccess(res, workOrdersService.listWorkOrders(), "Work orders fetched");
};

const create: RequestHandler = (req, res) => {
  const payload = createWorkOrderSchema.parse(req.body);
  const created = workOrdersService.createWorkOrder(payload);

  return sendSuccess(res, created, "Work order created", 201);
};

export const workOrdersController = {
  list,
  create
};
