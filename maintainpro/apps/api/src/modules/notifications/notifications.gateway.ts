import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RoleName } from "@prisma/client";
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import { verify } from "jsonwebtoken";
import type { Server, Socket } from "socket.io";
import { getAccessJwtSecret } from "../../config/jwt-secrets";
import { PrismaService } from "../../database/prisma.service";

type JwtPayload = {
  sub?: string;
  role?: RoleName;
  tenantId?: string | null;
};

@Injectable()
@WebSocketGateway({
  namespace: "/notifications",
  cors: {
    origin: (process.env.CORS_ORIGIN ?? process.env.FRONTEND_URL ?? "http://localhost:3001")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true
  }
})
export class NotificationsGateway implements OnGatewayConnection {
  private static readonly USER_ROOM_PREFIX = "user:";
  private static readonly TENANT_ROOM_PREFIX = "tenant:";

  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  async handleConnection(client: Socket) {
    const token = this.extractToken(client);

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = verify(
        token,
        getAccessJwtSecret(this.configService)
      ) as JwtPayload;

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

      if (!payload.tenantId && payload.role !== RoleName.SUPER_ADMIN) {
        client.disconnect(true);
        return;
      }

      client.join(this.userRoom(payload.sub));
      if (payload.tenantId) {
        client.join(this.tenantRoom(payload.tenantId));
      }
    } catch {
      this.logger.warn("Rejected notifications socket connection due to invalid JWT token");
      client.disconnect(true);
    }
  }

  emitToUser(userId: string, payload: unknown): void {
    this.server.to(this.userRoom(userId)).emit("notifications.new", payload);
  }

  emitMarkRead(userId: string, payload: unknown): void {
    this.server.to(this.userRoom(userId)).emit("notifications.updated", payload);
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

  private userRoom(userId: string): string {
    return `${NotificationsGateway.USER_ROOM_PREFIX}${userId}`;
  }

  private tenantRoom(tenantId: string): string {
    return `${NotificationsGateway.TENANT_ROOM_PREFIX}${tenantId}`;
  }
}
