import { Navigate, createBrowserRouter } from "react-router-dom";

import { AuthLayout } from "@/layouts/auth-layout";
import { AppLayout } from "@/layouts/app-layout";
import { AssetsPage } from "@/features/assets/pages/assets-page";
import { LoginPage } from "@/features/auth/pages/login-page";
import { DashboardPage } from "@/features/dashboard/pages/dashboard-page";
import { InventoryPage } from "@/features/inventory/pages/inventory-page";
import { NotificationsPage } from "@/features/notifications/pages/notifications-page";
import { PreventiveMaintenancePage } from "@/features/preventive-maintenance/pages/preventive-maintenance-page";
import { ReportsPage } from "@/features/reports/pages/reports-page";
import { SettingsPage } from "@/features/settings/pages/settings-page";
import { WorkOrdersPage } from "@/features/work-orders/pages/work-orders-page";

import { ProtectedRoute } from "./protected-route";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <AuthLayout />,
    children: [{ index: true, element: <LoginPage /> }]
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "assets", element: <AssetsPage /> },
      { path: "work-orders", element: <WorkOrdersPage /> },
      { path: "inventory", element: <InventoryPage /> },
      { path: "preventive-maintenance", element: <PreventiveMaintenancePage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "notifications", element: <NotificationsPage /> },
      { path: "settings", element: <SettingsPage /> }
    ]
  },
  {
    path: "*",
    element: <Navigate to="/" replace />
  }
]);
