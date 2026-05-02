import { Logger } from "@nestjs/common";
import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { Server } from "socket.io";

export type FleetAlertType =
  | "OVERSPEED"
  | "IDLE_TOO_LONG"
  | "GEOFENCE_ENTER"
  | "GEOFENCE_EXIT"
  | "DEVICE_OFFLINE"
  | "HARSH_DRIVING";

export type FleetAlertSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface FleetSocketAlert {
  id: string;
  type: FleetAlertType;
  severity: FleetAlertSeverity;
  vehicleId: string;
  registrationNo: string;
  message: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

@WebSocketGateway({
  namespace: "/fleet",
  cors: {
    origin: (process.env.CORS_ORIGIN ?? process.env.FRONTEND_URL ?? "http://localhost:3001")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true
  }
})
export class FleetGateway {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(FleetGateway.name);

  broadcastLocationUpdate(payload: unknown): void {
    this.server.emit("fleet.location.updated", payload);
    this.logger.log("Fleet location update broadcast");
  }

  broadcastAlertCreated(payload: FleetSocketAlert): void {
    this.server.emit("fleet.alert.created", payload);
    this.logger.warn(`Fleet alert broadcast: ${payload.type} for ${payload.registrationNo}`);
  }
}
