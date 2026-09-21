"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { apiOrigin } from "@/lib/api-url";
import {
  clearRealtimeUnavailableReport,
  realtimeSocketOptions,
  REALTIME_DISABLED,
  reportRealtimeUnavailable
} from "@/lib/realtime";

/**
 * Realtime notification stream (Nest gateway, namespace `/notifications` on the API
 * origin). Optional by design — the notification bell also polls `/notifications` through
 * the BFF — so a failed handshake is reported once, quietly, instead of a warning per
 * reconnection attempt. See lib/realtime.ts for the shared policy.
 */
const CHANNEL = "notifications";

export const useNotificationsSocket = (onEvent: (payload: unknown) => void) => {
  // Keep latest handler in a ref so we don't reconnect the socket on every render.
  const handlerRef = useRef(onEvent);
  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (REALTIME_DISABLED) {
      return;
    }

    let cancelled = false;
    let socket: Socket | null = null;

    // Defer connect a tick so React 18 StrictMode's double-invoke (mount → cleanup → mount)
    // doesn't tear down the WebSocket mid-handshake (causing
    // "WebSocket is closed before the connection is established").
    const timer = setTimeout(() => {
      if (cancelled) return;

      socket = io(`${apiOrigin}/notifications`, realtimeSocketOptions());

      const dispatch = (payload: unknown) => handlerRef.current(payload);
      socket.on("notifications.new", dispatch);
      socket.on("notifications.updated", dispatch);

      socket.on("connect", () => clearRealtimeUnavailableReport(CHANNEL));
      socket.on("connect_error", (err) => reportRealtimeUnavailable(CHANNEL, err.message));

      // Stop the manager once attempts are exhausted so it does not keep retrying.
      socket.io.on("reconnect_failed", () => {
        socket?.close();
      });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (socket) {
        socket.removeAllListeners();
        if (socket.connected) {
          socket.disconnect();
        } else {
          // If still mid-handshake, close once connected to avoid "closed before established".
          socket.once("connect", () => socket?.disconnect());
        }
      }
    };
  }, []);
};
