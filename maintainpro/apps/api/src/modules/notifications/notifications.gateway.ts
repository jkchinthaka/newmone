import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { Server } from "socket.io";

@WebSocketGateway({
  namespace: "/notifications",
  cors: { origin: "*" }
})
export class NotificationsGateway {
  @WebSocketServer()
  server!: Server;

  emitToUser(userId: string, payload: unknown): void {
    this.server.to(userId).emit("notifications.new", payload);
  }

  emitMarkRead(userId: string, payload: unknown): void {
    this.server.to(userId).emit("notifications.updated", payload);
  }
}
