import test from "node:test";
import assert from "node:assert/strict";

import { canDoGoodsIn, goodsInFormIssues, goodsInLinesFromRows, GOODS_IN_TEMPLATE_HEADERS } from "../goods-in";

test("goods in is for Admin, Super Admin and store keepers", () => {
  assert.equal(canDoGoodsIn("INVENTORY_KEEPER"), true);
  assert.equal(canDoGoodsIn("admin"), true);
  assert.equal(canDoGoodsIn("TECHNICIAN"), false);
  assert.equal(canDoGoodsIn(null), false);
});

test("reads the template columns and common header names, skipping blank rows", () => {
  const { lines, missingColumns } = goodsInLinesFromRows([
    [...GOODS_IN_TEMPLATE_HEADERS],
    ["BRG-6204", "Bearing 6204", "Bearings", "pcs", "10", "850", "ABC Traders", "GRN-1001"],
    ["", "", "", "", "", "", "", ""],
    ["BELT-A42", "V belt A42", "", "", "4", "", "", ""]
  ]);
  assert.deepEqual(missingColumns, []);
  assert.equal(lines.length, 2);
  assert.deepEqual(lines[0], {
    partNumber: "BRG-6204",
    name: "Bearing 6204",
    category: "Bearings",
    unit: "pcs",
    quantity: "10",
    unitCost: "850",
    supplierName: "ABC Traders",
    referenceNo: "GRN-1001"
  });
  assert.equal(lines[1].unitCost, null);

  const other = goodsInLinesFromRows([["Item Code", "Qty", "Price"], ["X-1", "3", "100"]]);
  assert.deepEqual(other.lines[0], {
    partNumber: "X-1",
    name: undefined,
    category: undefined,
    unit: undefined,
    quantity: "3",
    unitCost: "100",
    supplierName: undefined,
    referenceNo: undefined
  });
  assert.deepEqual(goodsInLinesFromRows([["Name", "Cost"]]).missingColumns, ["Part code", "Quantity"]);
});

test("one-item form checks", () => {
  const base = { partId: "", newPart: false, partNumber: "", name: "", quantity: "", unitCost: "" };
  assert.deepEqual(goodsInFormIssues(base), ["Choose the part, or tick New part.", "Quantity must be a whole number above 0."]);
  assert.deepEqual(goodsInFormIssues({ ...base, newPart: true, quantity: "2" }), ["Enter the part code.", "Enter the part name."]);
  assert.deepEqual(goodsInFormIssues({ ...base, partId: "p-1", quantity: "5", unitCost: "12.5" }), []);
});
