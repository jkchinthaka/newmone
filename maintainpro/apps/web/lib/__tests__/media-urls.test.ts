import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  firstRenderableImageUrl,
  isRenderableImageUrl,
  parseUrlList
} from "../media-urls";

describe("parseUrlList", () => {
  it("parses JSON-string arrays from SQL NVarChar columns", () => {
    assert.deepEqual(parseUrlList('["https://cdn.example/a.jpg","/uploads/b.png"]'), [
      "https://cdn.example/a.jpg",
      "/uploads/b.png"
    ]);
  });

  it("accepts already-parsed arrays", () => {
    assert.deepEqual(parseUrlList(["https://cdn.example/a.jpg", ""]), ["https://cdn.example/a.jpg"]);
  });

  it("returns [] for empty / invalid values so UI never indexes a string", () => {
    assert.deepEqual(parseUrlList("[]"), []);
    assert.deepEqual(parseUrlList(""), []);
    assert.deepEqual(parseUrlList(null), []);
    assert.deepEqual(parseUrlList(undefined), []);
    assert.deepEqual(parseUrlList("{not-json"), []);
    assert.deepEqual(parseUrlList("["), []);
  });

  it("supports legacy comma / newline separated URLs", () => {
    assert.deepEqual(parseUrlList("https://a.example/x.jpg, /y.png"), [
      "https://a.example/x.jpg",
      "/y.png"
    ]);
  });
});

describe("isRenderableImageUrl / firstRenderableImageUrl", () => {
  it("rejects the classic '[' character that produced <img src=\"[\">", () => {
    assert.equal(isRenderableImageUrl("["), false);
    assert.equal(firstRenderableImageUrl("[]"), null);
    assert.equal(firstRenderableImageUrl("["), null);
  });

  it("rejects javascript: and bare filenames", () => {
    assert.equal(isRenderableImageUrl("javascript:alert(1)"), false);
    assert.equal(isRenderableImageUrl("photo.jpg"), false);
  });

  it("accepts http(s), root-relative, and data:image URLs", () => {
    assert.equal(isRenderableImageUrl("https://cdn.example/a.jpg"), true);
    assert.equal(isRenderableImageUrl("http://cdn.example/a.jpg"), true);
    assert.equal(isRenderableImageUrl("/uploads/a.jpg"), true);
    assert.equal(isRenderableImageUrl("data:image/png;base64,abc"), true);
  });

  it("picks the first safe URL from a mixed JSON list", () => {
    assert.equal(
      firstRenderableImageUrl('["[", "https://cdn.example/ok.jpg"]'),
      "https://cdn.example/ok.jpg"
    );
  });
});
