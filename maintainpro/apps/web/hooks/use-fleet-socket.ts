"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";

type FleetSocketHandlers = {
  onLocationUpdated?: (payload: unknown) => void;
  onAlertCreated?: (payload: unknown) => void;
};

export const useFleetSocket = ({ onLocationUpdated, onAlertCreated }: FleetSocketHandlers) => {
  useEffect(() => {
    const socket = io(`${process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3000"}/fleet`, {
      transports: ["websocket"]
    });

    if (onLocationUpdated) {
      socket.on("fleet.location.updated", onLocationUpdated);
    }

    if (onAlertCreated) {
      socket.on("fleet.alert.created", onAlertCreated);
    }

    return () => {
      if (onLocationUpdated) {
        socket.off("fleet.location.updated", onLocationUpdated);
      }

      if (onAlertCreated) {
        socket.off("fleet.alert.created", onAlertCreated);
      }

      socket.disconnect();
    };
  }, [onAlertCreated, onLocationUpdated]);
};
