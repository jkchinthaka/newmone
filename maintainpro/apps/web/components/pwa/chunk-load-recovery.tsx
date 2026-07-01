"use client";

import { useEffect } from "react";

const CHUNK_ERROR_PATTERN = /ChunkLoadError|Loading chunk [\d]+ failed|Failed to fetch dynamically imported module/i;

function shouldReloadForChunkFailure(message: string) {
  return CHUNK_ERROR_PATTERN.test(message);
}

export function ChunkLoadRecovery() {
  useEffect(() => {
    const reloadKey = "maintainpro:chunk-reload";

    const tryRecover = (message: string) => {
      if (!shouldReloadForChunkFailure(message)) {
        return;
      }
      if (sessionStorage.getItem(reloadKey) === "1") {
        return;
      }
      sessionStorage.setItem(reloadKey, "1");
      window.location.reload();
    };

    const onError = (event: ErrorEvent) => {
      tryRecover(event.message || String(event.error ?? ""));
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason ?? "");
      tryRecover(message);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
