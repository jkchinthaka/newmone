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

/** Live fleet positions/alerts (Nest gateway, namespace `/fleet`). Optional: the map also
 *  polls /fleet/live-map, so a failed handshake is reported once instead of per attempt. */
const CHANNEL = "fleet";

type FleetSocketHandlers = {
  onLocationUpdated?: (payload: unknown) => void;
  onAlertCreated?: (payload: unknown) => void;
};

export const useFleetSocket = ({ onLocationUpdated, onAlertCreated }: FleetSocketHandlers) => {
  const handlersRef = useRef<FleetSocketHandlers>({ onLocationUpdated, onAlertCreated });
  useEffect(() => {
    handlersRef.current = { onLocationUpdated, onAlertCreated };
  }, [onLocationUpdated, onAlertCreated]);

  useEffect(() => {
    if (REALTIME_DISABLED) {
      return;
    }

    let cancelled = false;
    let socket: Socket | null = null;

    const timer = setTimeout(() => {
      if (cancelled) return;
      socket = io(`${apiOrigin}/fleet`, realtimeSocketOptions());

      socket.on("fleet.location.updated", (p) => handlersRef.current.onLocationUpdated?.(p));
      socket.on("fleet.alert.created", (p) => handlersRef.current.onAlertCreated?.(p));
      socket.on("connect", () => clearRealtimeUnavailableReport(CHANNEL));
      socket.on("connect_error", (err) => reportRealtimeUnavailable(CHANNEL, err.message));

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
          socket.once("connect", () => socket?.disconnect());
        }
      }
    };
  }, []);
};
