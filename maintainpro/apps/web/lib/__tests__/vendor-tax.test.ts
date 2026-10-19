import assert from "node:assert/strict";
import test from "node:test";

import { previewVendorTax, taxRateInputIsValid } from "../vendor-tax";

test("live tax preview uses the tenant rate on the entered amount", () => {
  assert.deepEqual(previewVendorTax(10_000, 18), { taxAmount: 1800, totalAmount: 11800 });
  assert.deepEqual(previewVendorTax(10.01, 18), { taxAmount: 1.8, totalAmount: 11.81 });
  assert.equal(taxRateInputIsValid("0"), true);
  assert.equal(taxRateInputIsValid("18.125"), false);
  assert.equal(taxRateInputIsValid("101"), false);
});
