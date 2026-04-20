import { Outlet } from "react-router-dom";

export const AuthLayout = () => {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden bg-brand-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <p className="inline-block rounded-full border border-white/30 px-3 py-1 text-xs uppercase tracking-[0.2em]">
            MaintainPro
          </p>
          <h1 className="mt-8 text-4xl font-bold leading-tight">
            Keep every asset healthy, every technician aligned.
          </h1>
          <p className="mt-4 max-w-md text-sm text-teal-50">
            Centralize work orders, preventive maintenance, inventory, and real-time operational insights.
          </p>
        </div>
        <p className="text-xs text-teal-100">CMMS platform tailored for modern maintenance teams.</p>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-xl">
          <Outlet />
        </div>
      </section>
    </div>
  );
};
