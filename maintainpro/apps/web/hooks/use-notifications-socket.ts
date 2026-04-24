"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";
import { getAccessToken } from "@/lib/auth-storage";

export const useNotificationsSocket = (onEvent: (payload: unknown) => void) => {
  useEffect(() => {
    const token = getAccessToken();

    if (!token) {
      return;
    }

    const socket = io(`${process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3000"}/notifications`, {
      transports: ["websocket"],
      auth: {
        token
      }
    });

    socket.on("notifications.new", onEvent);
    socket.on("notifications.updated", onEvent);

    return () => {
      socket.off("notifications.new", onEvent);
      socket.off("notifications.updated", onEvent);
      socket.disconnect();
    };
  }, [onEvent]);
};
