"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";

export const useNotificationsSocket = (onEvent: (payload: unknown) => void) => {
  useEffect(() => {
    const socket = io(`${process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3000"}/notifications`);

    socket.on("notifications.new", onEvent);
    socket.on("notifications.updated", onEvent);

    return () => {
      socket.off("notifications.new", onEvent);
      socket.off("notifications.updated", onEvent);
      socket.disconnect();
    };
  }, [onEvent]);
};
