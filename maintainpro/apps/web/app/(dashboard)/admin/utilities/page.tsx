"use client";

import Link from "next/link";
import { useCurrentUser } from "@/lib/use-current-user";

export default function AdminUtilitiesPage() {
  const user = useCurrentUser();
  if (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN" && user.role !== "ASSET_MANAGER") {
    return <p className="p-4">Access required</p>;
  }
  return (
    <main className="mx-auto max-w-xl space-y-3 p-4">
      <h1 className="text-2xl font-semibold">Utilities setup</h1>
      <p>Meter setup, editing, deactivation, and bills stay on the existing utilities pages.</p>
      <Link href="/utilities">Open meter setup and bills</Link>
      <Link href="/reports">Open utility consumption analytics</Link>
    </main>
  );
}
