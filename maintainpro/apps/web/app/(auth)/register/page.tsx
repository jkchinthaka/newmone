import { Suspense } from "react";

import { MaintainProLogo } from "@/components/brand/maintainpro-logo";
import { RegisterFormCard } from "./register-form-card";

function RegisterFallback() {
  return (
    <main className="grid min-h-screen place-items-center bg-brand-50 p-6">
      <section className="w-full max-w-2xl rounded-[32px] border border-white/60 bg-white/92 p-8 shadow-[0_32px_80px_rgba(15,23,42,0.14)] backdrop-blur xl:p-10">
        <MaintainProLogo showTagline size="md" />
        <p className="mt-6 text-sm text-slate-600">Loading registration form...</p>
      </section>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterFallback />}>
      <RegisterFormCard />
    </Suspense>
  );
}
