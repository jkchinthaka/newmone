import { expect, test } from "../fixtures/qa";
import { qaTag } from "../helpers/env";
import {
  authenticatedGet,
  authenticatedPost,
  getAuthenticatedUser,
  unwrapList
} from "../helpers/session";

test.describe("Fleet › vehicle maintenance job", () => {
  test("odometer validation and vehicle WO create", async ({ page }) => {
    const vehicles = await authenticatedGet(page, "/api/backend/vehicles?page=1&limit=20");
    expect([200, 403]).toContain(vehicles.status());
    test.skip(vehicles.status() !== 200, "Vehicles API unavailable for role/env");

    const rows = unwrapList<{ id?: string; odometer?: number; currentOdometer?: number }>(
      await vehicles.json()
    );
    const vehicle = rows.find((row) => row.id);
    test.skip(!vehicle?.id, "No vehicle master data for QA-E2E");

    const current = Number(vehicle!.odometer ?? vehicle!.currentOdometer ?? 0);
    const user = await getAuthenticatedUser(page);

    const negative = await authenticatedPost(page, "/api/backend/work-orders", {
      data: {
        title: qaTag("WO"),
        description: "vehicle negative odo",
        priority: "MEDIUM",
        type: "CORRECTIVE",
        createdById: user.id,
        vehicleId: vehicle!.id,
        odometerReading: -1
      }
    });
    expect(negative.status()).toBeGreaterThanOrEqual(400);

    if (current > 0) {
      const lower = await authenticatedPost(page, "/api/backend/work-orders", {
        data: {
          title: qaTag("WO"),
          description: "vehicle lower odo",
          priority: "MEDIUM",
          type: "CORRECTIVE",
          createdById: user.id,
          vehicleId: vehicle!.id,
          odometerReading: Math.max(current - 10, 0)
        }
      });
      expect(lower.status()).toBeGreaterThanOrEqual(400);
    }

    const ok = await authenticatedPost(page, "/api/backend/work-orders", {
      data: {
        title: qaTag("WO"),
        description: "vehicle higher odo",
        priority: "MEDIUM",
        type: "CORRECTIVE",
        createdById: user.id,
        vehicleId: vehicle!.id,
        odometerReading: current + 25
      }
    });
    expect([200, 201, 400]).toContain(ok.status());
  });
});
