"use client";

import { useSyncExternalStore } from "react";

import { getPwaServerSnapshot, getPwaSnapshot, subscribePwa } from "@/lib/pwa-install-store";

export function usePwa() {
  return useSyncExternalStore(subscribePwa, getPwaSnapshot, getPwaServerSnapshot);
}
