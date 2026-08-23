import assert from "node:assert/strict";
import test from "node:test";
import { shapeGeometry } from "../src/core/engine/shapes/shape-geometry.ts";
import type { CanvasShapeObject } from "../src/core/engine/shapes/geometry-types.ts";
import { ShapeParameterDragSession } from "../src/core/runtime/shape-parameter-drag.ts";

function shape(type: CanvasShapeObject["type"], attributes: Record<string, number> = {}) {
  return {
    id: type,
    type,
    x: 10,
    y: 20,
    width: 200,
    height: 100,
    rotation: 0,
    opacity: 1,
    fill: 0xffffff,
    stroke: 0,
    strokeWidth: 2,
    fillStyle: "solid",
    cornerRadius: 12,
    arcSweep: 1,
    waistRatio: 0.5,
    shoulderRatio: 0.38,
    apexRatio: 0.5,
    slantRatio: 0.2,
    ...attributes,
  } as CanvasShapeObject;
}

test("shape resize handles sit on each shape outline", () => {
  const ellipse = shape("ellipse");
  assert.deepEqual(
    shapeGeometry.resizeHandles(ellipse).map(({ point }) => point),
    [
      { x: 100, y: 0 },
      { x: 0, y: 50 },
    ],
  );

  const diamond = shape("diamond");
  for (const { point } of shapeGeometry.resizeHandles(diamond)) {
    assert.equal(
      shapeGeometry
        .points(diamond)
        .some((candidate) => candidate.x === point.x && candidate.y === point.y),
      true,
    );
  }
});

test("rectangle radius handle stays inside and follows drag displacement", () => {
  const rectangle = shape("rect", { cornerRadius: 0 });
  const [handle] = shapeGeometry.parameterHandles(rectangle);
  assert.ok(handle.point.x < rectangle.width);
  assert.ok(handle.point.y > 0);

  const session = new ShapeParameterDragSession();
  const start = shapeGeometry.localToWorld(rectangle, handle.point);
  const drag = session.create(rectangle, "cornerRadius", start);
  assert.ok(drag);
  assert.equal(session.update(rectangle, drag, { x: start.x - 30, y: start.y + 30 }), true);
  assert.equal(rectangle.cornerRadius, 30);
  session.update(rectangle, drag, { x: start.x + 200, y: start.y - 200 });
  assert.equal(rectangle.cornerRadius, 0);
});

test("partial ellipses are pie sectors with a clamped sweep", () => {
  const ellipse = shape("ellipse", { arcSweep: 0.5 });
  assert.deepEqual(shapeGeometry.points(ellipse)[0], { x: 100, y: 50 });
  shapeGeometry.setParameter(ellipse, "arcSweep", { x: 100, y: -1000 });
  assert.ok(ellipse.arcSweep >= 0.01 && ellipse.arcSweep <= 1);
});

test("polygon parameter handles update normalized geometry", () => {
  const diamond = shape("diamond");
  shapeGeometry.setParameter(diamond, "waistRatio", { x: 100, y: 63 });
  assert.equal(diamond.waistRatio, 0.85);

  const pentagon = shape("pentagon");
  shapeGeometry.setParameter(pentagon, "apexRatio", { x: 100, y: 10 });
  shapeGeometry.setParameter(pentagon, "shoulderRatio", { x: 180, y: 65 });
  assert.ok(pentagon.apexRatio >= 0.2 && pentagon.apexRatio <= 0.8);
  assert.ok(pentagon.shoulderRatio >= 0.18 && pentagon.shoulderRatio <= 0.68);

  const parallelogram = shape("parallelogram");
  shapeGeometry.setParameter(parallelogram, "slantRatio", { x: 129, y: 0 });
  assert.ok(parallelogram.slantRatio >= 0 && parallelogram.slantRatio <= 0.45);
});

test("shape hit testing follows polygon geometry instead of the bounding box", () => {
  const diamond = shape("diamond");
  assert.equal(shapeGeometry.containsPoint(diamond, { x: 110, y: 70 }), true);
  assert.equal(shapeGeometry.containsPoint(diamond, { x: 12, y: 22 }), false);
});
