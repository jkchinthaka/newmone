import { useTranslation } from "react-i18next";

import { LoginForm } from "../components/login-form";

export const LoginPage = () => {
  const { t } = useTranslation();

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.16em] text-brand-700">CMMS Platform</p>
      <h2 className="mt-2 text-3xl font-bold text-slate-900">{t("login")}</h2>
      <p className="mt-2 text-sm text-slate-600">Access work orders, asset reliability metrics, and proactive maintenance tools.</p>

      <div className="mt-6">
        <LoginForm />
      </div>
    </div>
  );
};
