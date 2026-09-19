"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) {
      return;
    }

    // Skip in local dev: an active SW caches JS chunks and silently serves stale
    // bundles across Fast Refresh reloads, masking real code changes. PWA/offline
    // behavior should be verified against a production build instead.
    if (process.env.NODE_ENV === "development") {
      return;
    }

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch(() => undefined);
  }, []);

  return null;
}