import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const password = process.env.MAINTAINPRO_SEED_PASSWORD?.trim() ?? "";
const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";

test("admin registers one vehicle after a double-click and the record stays on reload", async ({ page }) => {
  test.skip(!password || !databaseUrl, "MAINTAINPRO_SEED_PASSWORD and DATABASE_URL are required");
  test.setTimeout(90_000);

  const registrationNo = `CP E2E-${Date.now()}`;
  const prisma = new PrismaClient();

  try {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.locator("#login-email").fill("admin@maintainpro.local");
    await page.locator("#login-password").fill(password);
    await page.getByRole("button", { name: /^Sign in$/ }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });

    await page.goto("/admin/vehicles/new");
    await expect(page.getByRole("heading", { name: "Register vehicle" })).toBeVisible();
    await page.locator("#registration").fill(` ${registrationNo.toLowerCase()} `);
    await page.locator("#type").selectOption("TRUCK");
    await page.locator("#fuel").selectOption("DIESEL");
    await page.locator("#make").fill("Tata");
    await page.locator("#model").fill("Ace");
    await page.locator("#year").fill("2024");
    await page.getByText("More details (optional)").click();
    await page.locator("#ownership").selectOption("OWNED");
    await page.locator("#mileage").fill("1200");
    await page.locator("#asset-tag").fill("AST-E2E");

    await page.getByRole("button", { name: "Register vehicle" }).dblclick();
    await expect(page.getByRole("status")).toHaveText("Vehicle registered.");

    const openVehicle = page.getByRole("link", { name: "Open vehicle" });
    const href = await openVehicle.getAttribute("href");
    expect(href).toMatch(/^\/vehicles\/.+/);
    const vehicleId = href!.split("/").pop()!;

    const count = await prisma.vehicle.count({ where: { registrationNo } });
    expect(count).toBe(1);

    await page.goto(`/vehicles/${vehicleId}`);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Tata Ace" })).toBeVisible();
    await expect(page.getByText(`Registration: ${registrationNo}`)).toBeVisible();
    await expect(page.getByText("Truck", { exact: true })).toBeVisible();
    await expect(page.getByText("Diesel", { exact: true })).toBeVisible();
    await expect(page.getByText("1,200 km")).toBeVisible();
  } finally {
    await prisma.vehicle.deleteMany({ where: { registrationNo } });
    await prisma.$disconnect();
  }
});
