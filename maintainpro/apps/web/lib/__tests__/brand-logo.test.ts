import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { NELNA_LOGO_ALT, NELNA_LOGO_HEIGHT, NELNA_LOGO_SRC, NELNA_LOGO_WIDTH } from "../../components/brand/nelna-logo";
import { BRAND_PRODUCT_LINE } from "../../components/brand/app-brand-lockup";
import { PRODUCT_NAME } from "../branding";

test("official Nelna Group logo asset is the brand source", () => {
  const asset = path.join(process.cwd(), "public", NELNA_LOGO_SRC.replace(/^\//, ""));
  assert.equal(existsSync(asset), true);
  assert.equal(NELNA_LOGO_SRC, "/brand/nelna-group-logo.jpg");
  assert.equal(NELNA_LOGO_ALT, "Nelna Group");
  assert.equal(NELNA_LOGO_WIDTH, 725);
  assert.equal(NELNA_LOGO_HEIGHT, 563);
  assert.equal(PRODUCT_NAME, "MaintainPro");
  assert.equal(BRAND_PRODUCT_LINE, "Maintenance Management System");
});
