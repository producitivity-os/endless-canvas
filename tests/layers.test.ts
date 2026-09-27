import assert from "node:assert/strict";
import test from "node:test";

import { RectangleObject } from "../src/core/model/shapes/rectangle.ts";
import {
  normalizeCanvasLayers,
  uniqueCanvasLayerId,
  visibleCanvasObjects,
} from "../src/core/model/layers.ts";
import type { EndlessCanvasState } from "../src/core/types/canvas.ts";

const rectangle = (id: string, layerId?: string) => new RectangleObject({
  id,
  layerId,
  type: "rect",
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  fill: 0xffffff,
  stroke: 0,
});

test("legacy canvas states migrate objects to one active layer", () => {
  const state: EndlessCanvasState = { objects: [rectangle("legacy")] };
  const layers = normalizeCanvasLayers(state);
  assert.equal(layers.length, 1);
  assert.equal(state.activeLayerId, "main");
  assert.equal(state.objects[0].layerId, "main");
});

test("layer ids are unique and stable", () => {
  const layers = [{ id: "notes", name: "Notes", zIndex: 0, visible: true, opacity: 1 }];
  assert.equal(uniqueCanvasLayerId(layers, "Notes"), "notes-2");
  assert.equal(uniqueCanvasLayerId([...layers, { ...layers[0], id: "notes-2" }], "Notes"), "notes-3");
});

test("normalization preserves z order and clamps visibility settings", () => {
  const state: EndlessCanvasState = {
    layers: [
      { id: "top", name: "Top", zIndex: 9, visible: false, opacity: 4 },
      { id: "bottom", name: "Bottom", zIndex: -2, visible: true, opacity: -1 },
    ],
    activeLayerId: "missing",
    focusedLayerId: "top",
    objects: [rectangle("a", "top"), rectangle("b", "bottom")],
  };
  const layers = normalizeCanvasLayers(state);
  assert.deepEqual(layers.map((layer) => [layer.id, layer.zIndex, layer.opacity]), [
    ["bottom", 0, 0],
    ["top", 1, 1],
  ]);
  assert.equal(state.activeLayerId, "top");
  assert.deepEqual(visibleCanvasObjects(state).map((object) => object.id), ["b"]);
});
