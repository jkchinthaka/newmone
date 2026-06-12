import { Inject, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RoleName } from "@prisma/client";
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { verify } from "jsonwebtoken";
import type { Server, Socket } from "socket.io";
import { getAccessJwtSecret } from "../../config/jwt-secrets";
import { PrismaService } from "../../database/prisma.service";

export type FleetAlertType =
  | "OVERSPEED"
  | "IDLE_TOO_LONG"
  | "GEOFENCE_ENTER"
  | "GEOFENCE_EXIT"
  | "DEVICE_OFFLINE"
  | "HARSH_DRIVING";

export type FleetAlertSeverity = "INFO" | "WARNING" | "CRITICAL";
type JwtPayload = {
  sub?: string;
  role?: RoleName;
  tenantId?: string | null;
};

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
export class FleetGateway implements OnGatewayConnection {
  private static readonly TENANT_ROOM_PREFIX = "tenant:";
  private static readonly GLOBAL_ROOM = "fleet:global";

  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(FleetGateway.name);

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = verify(token, getAccessJwtSecret(this.configService)) as JwtPayload;
      if (!payload.sub) {
        client.disconnect(true);
        return;
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { isActive: true }
      });
      if (!user?.isActive) {
        client.disconnect(true);
        return;
      }

      if (payload.tenantId) {
        client.join(this.tenantRoom(payload.tenantId));
      } else if (payload.role === RoleName.SUPER_ADMIN) {
        client.join(FleetGateway.GLOBAL_ROOM);
      } else {
        client.disconnect(true);
      }
    } catch {
      this.logger.warn("Rejected fleet socket connection due to invalid JWT token");
      client.disconnect(true);
    }
  }

  broadcastLocationUpdate(payload: unknown, tenantId: string | null): void {
    if (tenantId) {
      this.server.to(this.tenantRoom(tenantId)).emit("fleet.location.updated", payload);
    } else {
      this.server.to(FleetGateway.GLOBAL_ROOM).emit("fleet.location.updated", payload);
    }
    this.logger.log("Fleet location update broadcast");
  }

  broadcastAlertCreated(payload: FleetSocketAlert, tenantId: string | null): void {
    if (tenantId) {
      this.server.to(this.tenantRoom(tenantId)).emit("fleet.alert.created", payload);
    } else {
      this.server.to(FleetGateway.GLOBAL_ROOM).emit("fleet.alert.created", payload);
    }
    this.logger.warn(`Fleet alert broadcast: ${payload.type} for ${payload.registrationNo}`);
  }

  private tenantRoom(tenantId: string): string {
    return `${FleetGateway.TENANT_ROOM_PREFIX}${tenantId}`;
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === "string" && authToken.trim()) {
      return authToken.replace(/^Bearer\s+/i, "").trim();
    }

    const headerToken = client.handshake.headers.authorization;
    if (typeof headerToken === "string" && headerToken.trim()) {
      return headerToken.replace(/^Bearer\s+/i, "").trim();
    }

    const cookieHeader = client.handshake.headers.cookie;
    if (typeof cookieHeader === "string" && cookieHeader.trim()) {
      const match = cookieHeader
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith("maintainpro_access="));

      if (match) {
        return decodeURIComponent(match.slice("maintainpro_access=".length));
      }
    }

    return null;
  }
}
