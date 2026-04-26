"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "@/lib/auth-storage";

export const useNotificationsSocket = (onEvent: (payload: unknown) => void) => {
  // Keep latest handler in a ref so we don't reconnect the socket on every render.
  const handlerRef = useRef(onEvent);
  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      return;
    }

    let cancelled = false;
    let socket: Socket | null = null;

    // Defer connect a tick so React 18 StrictMode's double-invoke (mount → cleanup → mount)
    // doesn't tear down the WebSocket mid-handshake (causing
    // "WebSocket is closed before the connection is established").
    const timer = setTimeout(() => {
      if (cancelled) return;

      socket = io(
        `${process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3000"}/notifications`,
        {
          transports: ["websocket"],
          auth: { token },
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 10000
        }
      );

      const dispatch = (payload: unknown) => handlerRef.current(payload);
      socket.on("notifications.new", dispatch);
      socket.on("notifications.updated", dispatch);
      socket.on("connect_error", (err) => {
        // Surface but don't throw; auth failures cause the server to disconnect immediately.
        // eslint-disable-next-line no-console
        console.warn("[notifications-socket] connect_error:", err.message);
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
