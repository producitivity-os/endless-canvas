import assert from "node:assert/strict";
import test from "node:test";
import type { CanvasObject } from "../src/core/model/object.ts";
import { CanvasObjectExtensionRegistry } from "../src/core/runtime/object-extension-registry.ts";

test("object pointer gestures preserve their region and use rotated object-local coordinates", () => {
  const gestures: Array<{ phase: string; localPoint: { x: number; y: number } }> = [];
  const registry = new CanvasObjectExtensionRegistry([{
    type: "rect",
    pointerInteractionRegions: () => [{
      id: "waveform",
      bounds: { x: 0, y: 0, width: 100, height: 40 },
      capture: true,
    }],
    onPointerGesture: (_object, regionId, gesture) => {
      assert.equal(regionId, "waveform");
      gestures.push(gesture);
      return false;
    },
  }]);
  const object = {
    id: "rotated",
    type: "rect",
    layerId: "main",
    x: 100,
    y: 100,
    width: 100,
    height: 40,
    rotation: Math.PI / 2,
    opacity: 1,
  } as CanvasObject;

  const hit = registry.hitPointerInteractionRegion([object], { x: 150, y: 120 });
  assert.equal(hit?.region.id, "waveform");
  registry.activatePointerGesture(object, "waveform", "start", { x: 150, y: 120 });
  registry.activatePointerGesture(object, "waveform", "move", { x: 160, y: 120 });
  registry.activatePointerGesture(object, "waveform", "end", { x: 160, y: 120 });
  registry.activatePointerGesture(object, "waveform", "cancel", { x: 150, y: 120 });

  assert.deepEqual(gestures.map((gesture) => gesture.phase), ["start", "move", "end", "cancel"]);
  assert.deepEqual(gestures[0]?.localPoint, { x: 50, y: 20 });
  assert.ok(Math.abs((gestures[1]?.localPoint.x ?? 0) - 50) < 0.000001);
  assert.ok(Math.abs((gestures[1]?.localPoint.y ?? 0) - 10) < 0.000001);
});
