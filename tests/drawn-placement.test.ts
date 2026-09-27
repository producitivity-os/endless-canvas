import assert from "node:assert/strict";
import test from "node:test";
import { CanvasArrowInteraction } from "../src/core/runtime/arrow-interaction.ts";
import { canvasDrawnPlacement } from "../src/core/types/runtime.ts";

test("drawn placements normalize reverse drags and retain their center", () => {
  assert.deepEqual(canvasDrawnPlacement({ x: 90, y: 70 }, { x: 10, y: 20 }), {
    origin: { x: 90, y: 70 },
    endpoint: { x: 10, y: 20 },
    bounds: { x: 10, y: 20, width: 80, height: 50 },
    center: { x: 50, y: 45 },
    dragged: true,
  });
});

test("click placements remain centered on the clicked point", () => {
  assert.deepEqual(canvasDrawnPlacement({ x: 24, y: 36 }, { x: 24, y: 36 }), {
    origin: { x: 24, y: 36 },
    endpoint: { x: 24, y: 36 },
    bounds: { x: 24, y: 36, width: 0, height: 0 },
    center: { x: 24, y: 36 },
    dragged: false,
  });
});

test("arrow creation accepts pane-specific visual defaults", () => {
  const interaction = new CanvasArrowInteraction();
  interaction.beginCreation("arrow", { x: 0, y: 0 }, [], 1, undefined, {
    stroke: 0x7c3aed,
    strokeWidth: 4,
  });
  interaction.updateCreation({ x: 80, y: 30 }, [], 1);
  const arrow = interaction.finishCreation([]);
  assert.equal(arrow?.stroke, 0x7c3aed);
  assert.equal(arrow?.strokeWidth, 4);
});
