import path from "node:path";

import swaggerJsdoc from "swagger-jsdoc";

import { env } from "./env";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "MaintainPro API",
      version: "1.0.0",
      description: "CMMS backend API for MaintainPro"
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}`,
        description: "Local"
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  apis: [
    path.resolve(process.cwd(), "src/modules/**/*.routes.ts"),
    path.resolve(process.cwd(), "dist/modules/**/*.routes.js")
  ]
};

export const swaggerSpec = swaggerJsdoc(options);
