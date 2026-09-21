import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildEntitySearchParams } from "../use-entity-search";

describe("buildEntitySearchParams", () => {
  it("defaults to q + pageSize (vehicles / locations contract)", () => {
    const empty = buildEntitySearchParams({ query: "" });
    assert.deepEqual(empty, { pageSize: 20 });
    assert.equal("q" in empty, false);
    assert.equal("limit" in empty, false);
    assert.equal("search" in empty, false);

    const withQuery = buildEntitySearchParams({ query: "  ABC-12  " });
    assert.deepEqual(withQuery, { pageSize: 20, q: "ABC-12" });
    assert.equal("pageSize" in withQuery, true);
    assert.equal("limit" in withQuery, false);
  });

  it("supports assets contract: search + limit (no pageSize, no q)", () => {
    const empty = buildEntitySearchParams({
      query: "",
      searchParam: "search",
      pageSizeParam: "limit",
      pageSize: 20
    });
    assert.deepEqual(empty, { limit: 20 });
    assert.equal("pageSize" in empty, false);
    assert.equal("q" in empty, false);

    const withQuery = buildEntitySearchParams({
      query: "pump",
      searchParam: "search",
      pageSizeParam: "limit",
      pageSize: 20
    });
    assert.deepEqual(withQuery, { limit: 20, search: "pump" });
    assert.equal("pageSize" in withQuery, false);
    assert.equal("q" in withQuery, false);
  });

  it("forwards extraParams without clobbering size/search keys unless provided", () => {
    const params = buildEntitySearchParams({
      query: "x",
      searchParam: "search",
      pageSizeParam: "limit",
      extraParams: { status: "ACTIVE", page: 1 }
    });
    assert.deepEqual(params, { limit: 20, search: "x", status: "ACTIVE", page: 1 });
  });
});
