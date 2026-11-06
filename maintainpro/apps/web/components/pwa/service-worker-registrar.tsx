"use client";

import { useEffect } from "react";

import { markUpdateReady, startPwaStore } from "@/lib/pwa-install-store";

const UPDATE_CHECK_MS = 30 * 60 * 1000;

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    startPwaStore();

    if (!("serviceWorker" in navigator) || !window.isSecureContext) {
      return undefined;
    }

    // Skip in local dev: an active SW caches JS chunks and silently serves stale
    // bundles across Fast Refresh reloads, masking real code changes. PWA/offline
    // behavior should be verified against a production build instead.
    if (process.env.NODE_ENV === "development") {
      return undefined;
    }

    // A controller change while a controller already existed means a NEW version took over
    // (the very first install has no controller before it, so it never shows the banner).
    const hadController = Boolean(navigator.serviceWorker.controller);
    const onControllerChange = () => {
      if (hadController) markUpdateReady();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    let registration: ServiceWorkerRegistration | undefined;
    const checkForUpdate = () => {
      void registration?.update().catch(() => undefined);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") checkForUpdate();
    };

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        registration = reg;
        checkForUpdate();
      })
      .catch(() => undefined);

    // Installed apps stay open for days: look for a new version on every return and every 30 min.
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(checkForUpdate, UPDATE_CHECK_MS);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
