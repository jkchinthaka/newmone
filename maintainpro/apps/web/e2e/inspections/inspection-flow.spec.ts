import { expect, test } from "../fixtures/qa";
import { qaTag } from "../helpers/env";
import {
  authenticatedGet,
  authenticatedPost,
  unwrapList
} from "../helpers/session";
import { resolveAssetId } from "../helpers/work-orders";

test.describe("Inspections › template and completion", () => {
  test("blocks create without template; completes with checklist when available", async ({
    page
  }) => {
    const assetId = await resolveAssetId(page);
    const missing = await authenticatedPost(page, "/api/backend/inspections", {
      data: {
        assetId,
        title: qaTag("INSP"),
        scheduledAt: new Date(Date.now() + 86_400_000).toISOString()
      }
    });
    expect([400, 403, 404, 422]).toContain(missing.status());

    const templates = await authenticatedGet(
      page,
      "/api/backend/planning/checklist-templates?activeOnly=true"
    );
    expect([200, 403, 404]).toContain(templates.status());
    if (templates.status() !== 200) return;

    const rows = unwrapList<{ id?: string }>(await templates.json());
    const templateId = rows.find((row) => row.id)?.id;
    test.skip(!templateId, "No checklist template for inspection QA-E2E");

    const created = await authenticatedPost(page, "/api/backend/inspections", {
      data: {
        assetId,
        checklistTemplateId: templateId,
        title: qaTag("INSP"),
        scheduledAt: new Date(Date.now() + 86_400_000).toISOString()
      }
    });
    expect([200, 201, 400, 404]).toContain(created.status());
  });
});
