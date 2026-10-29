import { readFileSync } from "fs";
import { join } from "path";

import { normalizeDecimals, RESPONSE_SECRET_KEYS } from "../src/common/interceptors/response.interceptor";

describe("secrets never leave the API (visible in the browser Network tab)", () => {
  it("strips password and token hashes at any depth", () => {
    const out = normalizeDecimals({
      items: [
        {
          id: "wo-1",
          technician: { id: "u-1", firstName: "Sam", passwordHash: "$2b$10$abc", role: { name: "TECHNICIAN" } },
          createdBy: { id: "u-2", passwordHash: "$2b$10$def" }
        }
      ],
      token: { tokenHash: "x", replacedByTokenHash: "y", familyId: "f" },
      apiKey: { keyHash: "k", secretHash: "s", label: "ERP" }
    }) as Record<string, any>;
    const text = JSON.stringify(out);
    for (const key of RESPONSE_SECRET_KEYS) expect(text).not.toContain(`"${key}"`);
    expect(out.items[0].technician).toEqual({ id: "u-1", firstName: "Sam", role: { name: "TECHNICIAN" } });
    expect(out.token.familyId).toBe("f");
    expect(out.apiKey.label).toBe("ERP");
  });

  it("job list selects public user fields only", () => {
    const source = readFileSync(join(__dirname, "../src/modules/work-orders/work-order-queues.service.ts"), "utf8");
    const include = source.slice(source.indexOf("const listInclude"), source.indexOf("type WorkOrderRow"));
    expect(include).not.toMatch(/technician: \{ include: \{ role: true \} \}/);
    expect(include).toMatch(/technician: \{ select: \{ \.\.\.PUBLIC_USER_SUMMARY_SELECT/);
    expect(include).toMatch(/createdBy: \{ select: \{ \.\.\.PUBLIC_USER_SUMMARY_SELECT/);
  });
});
