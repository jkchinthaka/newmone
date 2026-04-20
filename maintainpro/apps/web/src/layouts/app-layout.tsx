import {
  Bell,
  Boxes,
  ClipboardList,
  Gauge,
  LogOut,
  Menu,
  Package,
  Settings,
  ShieldCheck,
  Wrench
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth.store";
import { useUiStore } from "@/store/ui.store";

const navItems = [
  { to: "/", icon: Gauge, labelKey: "dashboard" },
  { to: "/assets", icon: Boxes, labelKey: "assets" },
  { to: "/work-orders", icon: ClipboardList, labelKey: "workOrders" },
  { to: "/inventory", icon: Package, labelKey: "inventory" },
  { to: "/preventive-maintenance", icon: Wrench, labelKey: "preventiveMaintenance" },
  { to: "/reports", icon: ShieldCheck, labelKey: "reports" },
  { to: "/notifications", icon: Bell, labelKey: "notifications" },
  { to: "/settings", icon: Settings, labelKey: "settings" }
];

export const AppLayout = () => {
  const { t } = useTranslation();
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);

  return (
    <div className="flex min-h-screen">
      <aside
        className={`border-r border-slate-200 bg-white/90 transition-all ${
          sidebarOpen ? "w-72" : "w-0 overflow-hidden"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-100 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-brand-700">MaintainPro</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">CMMS Control Hub</p>
          </div>

          <nav className="flex-1 space-y-1 p-3">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      isActive ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"
                    }`
                  }
                >
                  <Icon size={16} />
                  <span>{t(item.labelKey)}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 px-5 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={toggleSidebar}>
                <Menu size={16} />
              </Button>
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Operations</p>
                <p className="text-sm font-semibold text-slate-800">MaintainPro Workspace</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-slate-900">{user?.fullName ?? "Guest"}</p>
                <p className="text-xs text-slate-500">{user?.role ?? "viewer"}</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  clearSession();
                }}
              >
                <LogOut size={14} className="mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
