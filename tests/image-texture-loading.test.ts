import assert from "node:assert/strict";
import test from "node:test";
import {
  imageRequestNeedsCors,
  imageSourceCandidates,
} from "../src/core/model/image/image-url.ts";

test("managed application media opts into WebGL-safe cross-origin image mode", () => {
  assert.equal(imageRequestNeedsCors("media://localhost/media-id/thumbnail"), true);
  assert.equal(imageRequestNeedsCors("asset://localhost/image.png"), false);
  assert.equal(imageRequestNeedsCors("blob:https://localhost/id"), false);
});

test("remote web images retain anonymous CORS loading", () => {
  assert.equal(imageRequestNeedsCors("https://example.com/image.png"), true);
  assert.equal(imageRequestNeedsCors("http://example.com/image.png"), true);
});

test("image source candidates prefer thumbnails and retain one content fallback", () => {
  assert.deepEqual(
    imageSourceCandidates(
      "media://localhost/media-id/thumbnail",
      "media://localhost/media-id/content",
    ),
    [
      "media://localhost/media-id/thumbnail",
      "media://localhost/media-id/content",
    ],
  );
  assert.deepEqual(imageSourceCandidates("same", "same"), ["same"]);
  assert.deepEqual(imageSourceCandidates("", " content "), ["content"]);
});
