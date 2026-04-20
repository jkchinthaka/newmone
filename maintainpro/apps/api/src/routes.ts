import { Router } from "express";

import { assetsRouter } from "./modules/assets/assets.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";
import { healthRouter } from "./modules/health/health.routes";
import { inventoryRouter } from "./modules/inventory/inventory.routes";
import { notificationsRouter } from "./modules/notifications/notifications.routes";
import { preventiveMaintenanceRouter } from "./modules/preventive-maintenance/preventive-maintenance.routes";
import { reportsRouter } from "./modules/reports/reports.routes";
import { usersRouter } from "./modules/users/users.routes";
import { workOrdersRouter } from "./modules/work-orders/work-orders.routes";

const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/assets", assetsRouter);
apiRouter.use("/work-orders", workOrdersRouter);
apiRouter.use("/preventive-maintenance", preventiveMaintenanceRouter);
apiRouter.use("/inventory", inventoryRouter);
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/notifications", notificationsRouter);
apiRouter.use("/reports", reportsRouter);

apiRouter.get("/", (_req, res) => {
  res.json({
    service: "MaintainPro API",
    version: "1.0.0"
  });
});

export { apiRouter };
