"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";

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
    let cancelled = false;
    let socket: Socket | null = null;

    const timer = setTimeout(() => {
      if (cancelled) return;
      socket = io(`${process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3000"}/fleet`, {
        transports: ["websocket"],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000
      });

      socket.on("fleet.location.updated", (p) => handlersRef.current.onLocationUpdated?.(p));
      socket.on("fleet.alert.created", (p) => handlersRef.current.onAlertCreated?.(p));
      socket.on("connect_error", (err) => {
        // eslint-disable-next-line no-console
        console.warn("[fleet-socket] connect_error:", err.message);
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
