import { Logger } from "@nestjs/common";
import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { Server } from "socket.io";

@WebSocketGateway({
  namespace: "/fleet",
  cors: {
    origin: "*"
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
}
