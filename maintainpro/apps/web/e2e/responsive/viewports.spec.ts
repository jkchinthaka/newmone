import { expect, test } from "../fixtures/qa";
import { assertNoRuntimeOverlay } from "../helpers/session";

const viewports = [
  { name: "1920x1080", width: 1920, height: 1080 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "mobile-390", width: 390, height: 844 }
];

test.describe("Responsive › shell usability", () => {
  for (const vp of viewports) {
    test(`${vp.name} action-center has no horizontal body overflow`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/action-center");
      await expect(page).not.toHaveURL(/\/login/);
      await assertNoRuntimeOverlay(page);

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth
        };
      });
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 2);
    });
  }
});
