import "dotenv/config";

import { ConfigService } from "@nestjs/config";

import { DeploymentReadinessService } from "../src/deployment-readiness.service";

const configService = new ConfigService(process.env);
const service = new DeploymentReadinessService(configService);
const summary = service.getSummary({
  databaseStatus: "operational",
  redisStatus: "disabled",
  emailState: "disabled",
  smsState: "disabled",
  erpState: "disabled",
  objectStorageStatus: "degraded"
});

console.log(JSON.stringify(summary, null, 2));

if (summary.overallStatus === "blocked") {
  process.exit(2);
}

if (summary.overallStatus === "warning") {
  process.exit(1);
}
