import assert from "node:assert/strict";
import test from "node:test";
import { arrowHeadGeometry, arrowHeadLength } from "../src/core/engine/arrows/index.ts";
import { arrowPathGeometry } from "../src/core/engine/arrows/arrow-path-geometry.ts";
import { selectionHandles } from "../src/core/engine/renderers/selection-handles.ts";
import { ArrowObject } from "../src/core/model/arrow/arrow.ts";
import { RectangleObject } from "../src/core/model/shapes/rectangle.ts";
import { EllipseObject } from "../src/core/model/shapes/ellipse.ts";
import { DiamondObject } from "../src/core/model/shapes/diamond.ts";
import { PentagonObject } from "../src/core/model/shapes/pentagon.ts";
import { ParallelogramObject } from "../src/core/model/shapes/parallelogram.ts";
import { CanvasArrowInteraction } from "../src/core/runtime/arrow-interaction.ts";

test("arrowhead geometry and shaft trimming remain fixed in world units", () => {
  const head = arrowHeadGeometry.resolve({ x: 100, y: 20 }, { x: 0, y: 20 });
  assert.equal(Math.hypot(head.tip.x - head.base.x, head.tip.y - head.base.y), arrowHeadLength);
  assert.equal(Math.hypot(head.left.x - head.right.x, head.left.y - head.right.y), 14);
  const trimmed = arrowHeadGeometry.trimPath(
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
    arrowHeadLength,
    arrowHeadLength,
  );
  assert.deepEqual(trimmed, [
    { x: 12, y: 0 },
    { x: 88, y: 0 },
  ]);
});

test("curved arrows expose endpoints and their on-curve center only", () => {
  const arrow = new ArrowObject({
    id: "curved",
    type: "arrow",
    x: 0,
    y: 0,
    width: 200,
    height: 1,
    rotation: 0,
    opacity: 1,
    start: { point: { x: 0, y: 0 } },
    end: { point: { x: 200, y: 0 } },
    path: {
      type: "curved",
      controls: [
        { along: 0.2, offset: 100 },
        { along: 0.8, offset: 100 },
      ],
    },
  });
  const geometry = arrowPathGeometry.resolve(arrow, [arrow]);
  const interaction = new CanvasArrowInteraction();
  assert.equal(interaction.hitHandle(arrow, [arrow], geometry.start, 1), "start");
  assert.equal(interaction.hitHandle(arrow, [arrow], geometry.end, 1), "end");
  const center = geometry.full[Math.floor(geometry.full.length / 2)];
  assert.equal(interaction.hitHandle(arrow, [arrow], center, 1), "center");
  assert.equal(interaction.hitHandle(arrow, [arrow], geometry.controls[0], 1), null);
});

test("every shape resize descriptor is circular without changing hit sizes", () => {
  const common = {
    x: 0,
    y: 0,
    width: 100,
    height: 80,
    rotation: 0,
    opacity: 1,
    fill: 0,
    stroke: 0,
    strokeWidth: 2,
    fillStyle: "solid" as const,
  };
  const shapes = [
    new RectangleObject({
      ...common,
      id: "rect",
      type: "rect",
    }),
    new EllipseObject({ ...common, id: "ellipse", type: "ellipse" }),
    new DiamondObject({ ...common, id: "diamond", type: "diamond" }),
    new PentagonObject({ ...common, id: "pentagon", type: "pentagon" }),
    new ParallelogramObject({
      ...common,
      id: "parallelogram",
      type: "parallelogram",
    }),
  ];
  for (const shape of shapes) {
    const descriptors = selectionHandles.descriptors(shape);
    assert.ok(descriptors.length > 0);
    assert.ok(descriptors.every((descriptor) => descriptor.appearance === "circle"));
    assert.ok(descriptors.every((descriptor) => descriptor.hitSize === 18));
  }
});
