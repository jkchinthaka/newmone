"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";

export const useFleetSocket = (onUpdate: (payload: unknown) => void) => {
  useEffect(() => {
    const socket = io(`${process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3000"}/fleet`);

    socket.on("fleet.location.updated", onUpdate);

    return () => {
      socket.off("fleet.location.updated", onUpdate);
      socket.disconnect();
    };
  }, [onUpdate]);
};
