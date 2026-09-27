import assert from "node:assert/strict";
import test from "node:test";

import { canvasOverviewProjector } from "../src/core/engine/canvas-overview.ts";
import { ArrowObject } from "../src/core/model/arrow/arrow.ts";
import { TextCard } from "../src/core/model/card/card.ts";
import { RectangleObject } from "../src/core/model/shapes/rectangle.ts";
import { canvasViewportFitter } from "../src/core/runtime/canvas-viewport-fitter.ts";
import type { EndlessCanvasState } from "../src/core/types/canvas.ts";

function card(id: string, x: number, y: number, layerId = "main") {
  return new TextCard({
    id,
    layerId,
    type: "card",
    x,
    y,
    width: 120,
    height: 80,
    rotation: 0,
    opacity: 1,
    elements: [],
  });
}

test("canvas overview contains only visible card outlines and connector paths", () => {
  const first = card("first", 20, 30);
  const second = card("second", 260, 170);
  const hidden = card("hidden", 800, 900, "hidden");
  const legacyShape = new RectangleObject({
    id: "legacy-shape",
    type: "rect",
    x: -100,
    y: -50,
    width: 20,
    height: 20,
    fill: 0xffffff,
    stroke: 0,
  });
  const connector = new ArrowObject({
    id: "connector",
    type: "arrow",
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    start: {
      point: { x: 140, y: 70 },
      binding: { objectId: first.id, anchor: { x: 1, y: 0.5 } },
    },
    end: {
      point: { x: 260, y: 210 },
      binding: { objectId: second.id, anchor: { x: 0, y: 0.5 } },
    },
  });
  const state: EndlessCanvasState = {
    objects: [first, second, hidden, legacyShape, connector],
    layers: [
      { id: "main", name: "Main", zIndex: 0, visible: true, opacity: 1 },
      { id: "hidden", name: "Hidden", zIndex: 1, visible: false, opacity: 1 },
    ],
    activeLayerId: "main",
  };

  const snapshot = canvasOverviewProjector.snapshot(
    state,
    { x: -100, y: -50, scale: 2 },
    { width: 800, height: 600 },
  );

  assert.deepEqual(
    snapshot.cards.map((value) => value.id),
    ["first", "second"],
  );
  assert.deepEqual(snapshot.cards[0].points, [
    { x: 20, y: 30 },
    { x: 140, y: 30 },
    { x: 140, y: 110 },
    { x: 20, y: 110 },
  ]);
  assert.deepEqual(
    {
      x: snapshot.cards[0].x,
      y: snapshot.cards[0].y,
      width: snapshot.cards[0].width,
      height: snapshot.cards[0].height,
      rotation: snapshot.cards[0].rotation,
    },
    { x: 20, y: 30, width: 120, height: 80, rotation: 0 },
  );
  assert.deepEqual(
    snapshot.connectors.map((value) => value.id),
    ["connector"],
  );
  assert.ok(snapshot.connectors[0].points.length >= 2);
  assert.equal(snapshot.contentBounds?.x, -100);
  assert.deepEqual(snapshot.viewportBounds, {
    x: 50,
    y: 25,
    width: 400,
    height: 300,
  });
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.cards[0].points), true);
});

test("viewport fitter preserves aspect ratio, padding, center, and zoom limits", () => {
  assert.deepEqual(
    canvasViewportFitter.fit(
      { x: 100, y: 50, width: 400, height: 200 },
      { width: 1000, height: 600 },
      { padding: 100 },
    ),
    { x: -100, y: 0, scale: 2 },
  );

  assert.equal(
    canvasViewportFitter.fit({ x: 0, y: 0, width: 1, height: 1 }, { width: 1000, height: 600 })
      .scale,
    5,
  );
  assert.equal(
    canvasViewportFitter.fit(
      { x: 0, y: 0, width: 100_000, height: 100_000 },
      { width: 1000, height: 600 },
    ).scale,
    0.1,
  );
});
