import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import { verify } from "jsonwebtoken";
import type { Server, Socket } from "socket.io";

type JwtPayload = {
  sub?: string;
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
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  handleConnection(client: Socket) {
    const token = this.extractToken(client);

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = verify(
        token,
        this.configService.get<string>("JWT_ACCESS_SECRET") ?? "dev-access-secret"
      ) as JwtPayload;

      if (!payload.sub) {
        client.disconnect(true);
        return;
      }

      client.join(payload.sub);
    } catch {
      this.logger.warn("Rejected notifications socket connection due to invalid JWT token");
      client.disconnect(true);
    }
  }

  emitToUser(userId: string, payload: unknown): void {
    this.server.to(userId).emit("notifications.new", payload);
  }

  emitMarkRead(userId: string, payload: unknown): void {
    this.server.to(userId).emit("notifications.updated", payload);
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
