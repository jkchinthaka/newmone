import { randomUUID } from "node:crypto";

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  reorderLevel: number;
}

const inventoryItems: InventoryItem[] = [
  {
    id: "inv-001",
    sku: "BRG-6001",
    name: "Ball Bearing 6001",
    quantity: 42,
    reorderLevel: 20
  },
  {
    id: "inv-002",
    sku: "BELT-A54",
    name: "Drive Belt A54",
    quantity: 6,
    reorderLevel: 12
  }
];

export const inventoryService = {
  listItems(): InventoryItem[] {
    return inventoryItems;
  },

  addItem(item: Omit<InventoryItem, "id">): InventoryItem {
    const created: InventoryItem = {
      id: randomUUID(),
      ...item
    };

    inventoryItems.push(created);
    return created;
  },

  lowStockItems(): InventoryItem[] {
    return inventoryItems.filter((item) => item.quantity <= item.reorderLevel);
  }
};
