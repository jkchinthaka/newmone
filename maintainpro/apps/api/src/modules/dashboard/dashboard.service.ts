export interface KpiSnapshot {
  openWorkOrders: number;
  mttrHours: number;
  onTimePmRate: number;
  lowStockItems: number;
}

export const dashboardService = {
  getKpis(): KpiSnapshot {
    return {
      openWorkOrders: 17,
      mttrHours: 4.6,
      onTimePmRate: 92.4,
      lowStockItems: 3
    };
  },

  getWorkOrderTrend(): Array<{ month: string; completed: number; backlog: number }> {
    return [
      { month: "Jan", completed: 40, backlog: 12 },
      { month: "Feb", completed: 44, backlog: 10 },
      { month: "Mar", completed: 51, backlog: 8 },
      { month: "Apr", completed: 47, backlog: 9 }
    ];
  }
};
