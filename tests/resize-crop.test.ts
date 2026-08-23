import assert from "node:assert/strict";
import test from "node:test";
import { boxGeometry } from "../src/core/engine/box-geometry.ts";
import { CanvasImageCropSession } from "../src/core/runtime/image-crop-session.ts";

function image() {
  return {
    id: "crop",
    type: "image",
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    rotation: 0,
    opacity: 1,
    src: "data:image/png;base64,",
    sourceWidth: 400,
    sourceHeight: 200,
    crop: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
    bounds() {
      return { x: this.x, y: this.y, width: this.width, height: this.height };
    },
  };
}

test("Shift preserves aspect ratio from top and left edge handles", () => {
  const origin = { x: 0, y: 0, width: 100, height: 50 };
  const fromTop = boxGeometry.resize(
    "top",
    origin,
    0,
    { x: 50, y: 0 },
    { x: 50, y: -50 },
    8,
    8,
    true,
  );
  assert.equal(fromTop.width / fromTop.height, 2);
  assert.equal(fromTop.y + fromTop.height, 50);

  const fromLeft = boxGeometry.resize(
    "left",
    origin,
    0,
    { x: 0, y: 25 },
    { x: -100, y: 25 },
    8,
    8,
    true,
  );
  assert.equal(fromLeft.width / fromLeft.height, 2);
  assert.equal(fromLeft.x + fromLeft.width, 100);
});

test("resizing without the proportional flag remains freeform", () => {
  const resized = boxGeometry.resize(
    "bottomRight",
    { x: 0, y: 0, width: 100, height: 50 },
    0,
    { x: 100, y: 50 },
    { x: 150, y: 70 },
    8,
    8,
    false,
  );
  assert.equal(resized.width, 150);
  assert.equal(resized.height, 70);
});

test("crop frame movement is draft-only and commits normalized crop once requested", () => {
  const subject = image();
  const session = new CanvasImageCropSession(subject as never);
  assert.equal(session.beginDrag({ x: 60, y: 45 }, 1), true);
  assert.equal(session.update({ x: 80, y: 45 }, 1), true);
  assert.equal(subject.crop.x, 0.25);
  session.endDrag();
  assert.equal(session.commit(), true);
  assert.equal(subject.crop.x, 0.35);
  assert.equal(subject.x, 30);
});

test("crop cancellation restores the original image snapshot", () => {
  const subject = image();
  subject.id = "cancel-crop";
  const session = new CanvasImageCropSession(subject as never);
  session.beginDrag({ x: 110, y: 70 }, 1);
  session.update({ x: 90, y: 60 }, 1);
  session.cancel();
  assert.deepEqual(subject.bounds(), { x: 10, y: 20, width: 100, height: 50 });
  assert.deepEqual(subject.crop, { x: 0.25, y: 0.25, width: 0.5, height: 0.5 });
});
