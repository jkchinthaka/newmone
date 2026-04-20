import type { RequestHandler } from "express";
import { z } from "zod";

import { sendSuccess } from "../../common/utils/response";
import { inventoryService } from "./inventory.service";

const addItemSchema = z.object({
  sku: z.string().min(2),
  name: z.string().min(2),
  quantity: z.number().int().min(0),
  reorderLevel: z.number().int().min(0)
});

const list: RequestHandler = (_req, res) => {
  return sendSuccess(res, inventoryService.listItems(), "Inventory items fetched");
};

const create: RequestHandler = (req, res) => {
  const payload = addItemSchema.parse(req.body);
  const created = inventoryService.addItem(payload);

  return sendSuccess(res, created, "Inventory item created", 201);
};

const lowStock: RequestHandler = (_req, res) => {
  return sendSuccess(res, inventoryService.lowStockItems(), "Low stock items fetched");
};

export const inventoryController = {
  list,
  create,
  lowStock
};
