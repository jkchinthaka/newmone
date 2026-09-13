import { readFileSync } from "fs";
import { join } from "path";

describe("production compose mobile FG broker wiring", () => {
  const productionCompose = readFileSync(
    join(__dirname, "../../../docker-compose.production.yml"),
    "utf8"
  );

  it("requires FG broker env on api service for mobile /mobile/fg bootstrap", () => {
    expect(productionCompose).toContain("FG_SSO_SIGNING_SECRET:");
    expect(productionCompose).toContain("FG_API_INTERNAL_URL:");
    expect(productionCompose).toContain("FG_MOBILE_SESSION_TTL_SECONDS:");
    expect(productionCompose).toMatch(/FG_API_INTERNAL_URL:.*http:\/\/fg:8000/);
  });
});
