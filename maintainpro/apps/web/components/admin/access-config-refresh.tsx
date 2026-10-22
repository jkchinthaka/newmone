"use client";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/lib/use-current-user";
import { apiClient } from "@/lib/api-client";
import { mergeStoredPublicUserProfile } from "@/lib/auth-storage";

/** No extra polling while OFF. An ON config change refreshes profile and page queries. */
export function AccessConfigRefresh() {
  const user = useCurrentUser();
  const client = useQueryClient();
  const version = useRef(user.accessConfigVersion);
  version.current = user.accessConfigVersion;
  useEffect(() => {
    if (!user.accessStudioEnabled || !user.id) return;
    let stopped = false;
    let pending = false;
    const refresh = async () => {
      if (pending || stopped) return;
      pending = true;
      try {
        const response = await apiClient.get<{ data: { accessConfigVersion?: number; accessStudioEnabled?: boolean } }>("/auth/me");
        if (stopped) return;
        const profile = response.data.data;
        const changed = profile.accessConfigVersion !== version.current || profile.accessStudioEnabled === false;
        mergeStoredPublicUserProfile(profile);
        if (changed) await client.invalidateQueries();
      } catch { /* Keep the current gates; normal request errors and preview banner remain authoritative. */ }
      finally { pending = false; }
    };
    const timer = window.setInterval(() => void refresh(), 15_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => { stopped = true; window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [user.id, user.accessStudioEnabled, client]);
  return null;
}
