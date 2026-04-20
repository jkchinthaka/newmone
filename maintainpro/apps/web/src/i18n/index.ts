import i18n from "i18next";
import { initReactI18next } from "react-i18next";

void i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: {
    en: {
      translation: {
        appName: "MaintainPro",
        dashboard: "Dashboard",
        assets: "Assets",
        workOrders: "Work Orders",
        inventory: "Inventory",
        preventiveMaintenance: "Preventive Maintenance",
        reports: "Reports",
        notifications: "Notifications",
        settings: "Settings",
        login: "Sign In"
      }
    },
    es: {
      translation: {
        appName: "MaintainPro",
        dashboard: "Panel",
        assets: "Activos",
        workOrders: "Ordenes de Trabajo",
        inventory: "Inventario",
        preventiveMaintenance: "Mantenimiento Preventivo",
        reports: "Reportes",
        notifications: "Notificaciones",
        settings: "Configuracion",
        login: "Iniciar Sesion"
      }
    }
  },
  interpolation: {
    escapeValue: false
  }
});

export default i18n;
