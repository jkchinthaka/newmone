import http from "node:http";

import { Server as SocketIOServer } from "socket.io";

import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { prisma } from "./config/prisma";
import { redis } from "./config/redis";

const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: env.CORS_ORIGIN,
    credentials: true
  }
});

io.on("connection", (socket) => {
  logger.info(`Socket connected: ${socket.id}`);

  socket.on("maintenance:ping", () => {
    socket.emit("maintenance:pong", {
      timestamp: new Date().toISOString()
    });
  });

  socket.on("disconnect", () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

app.set("io", io);

server.listen(env.PORT, () => {
  logger.info(`MaintainPro API running at http://localhost:${env.PORT}`);
});

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  logger.info(`Shutdown signal received: ${signal}`);

  server.close(async () => {
    await Promise.allSettled([redis.quit(), prisma.$disconnect()]);
    logger.info("MaintainPro API stopped");
    process.exit(0);
  });
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
