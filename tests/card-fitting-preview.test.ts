import assert from "node:assert/strict";
import test from "node:test";
import type { Texture } from "pixi.js";
import { ArrowObject } from "../src/core/model/arrow/arrow.ts";
import { TextCard } from "../src/core/model/card/card.ts";
import { PathObject } from "../src/core/model/shapes/path.ts";
import { RectangleObject } from "../src/core/model/shapes/rectangle.ts";
import { canvasObjectFactory } from "../src/core/model/object-factory.ts";
import { fitCardToContent } from "../src/core/engine/card-content-fitter.ts";
import { canvasVisualBounds } from "../src/core/engine/visual-bounds.ts";
import { CardPreviewCache } from "../src/core/engine/renderers/card-preview-cache.ts";
import { minCardHeight, minCardWidth } from "../src/core/engine/utils.ts";
import type { CanvasObject } from "../src/core/model/object.ts";

function rectangle(id: string, x: number, y: number, rotation = 0): RectangleObject {
  return new RectangleObject({
    id,
    type: "rect",
    x,
    y,
    width: 100,
    height: 30,
    rotation,
    opacity: 1,
    fill: 0xffffff,
    stroke: 0,
    strokeWidth: 4,
    fillStyle: "solid",
  });
}

function card(id: string, elements: CanvasObject[]): TextCard {
  return new TextCard({
    id,
    type: "card",
    x: 300,
    y: 200,
    width: 260,
    height: 180,
    rotation: Math.PI / 5,
    opacity: 1,
    elements,
  });
}

function localToParent(value: TextCard, point: { x: number; y: number }) {
  const half = { x: value.width / 2, y: value.height / 2 };
  const cosine = Math.cos(value.rotation);
  const sine = Math.sin(value.rotation);
  const local = { x: point.x - half.x, y: point.y - half.y };
  return {
    x: value.x + half.x + local.x * cosine - local.y * sine,
    y: value.y + half.y + local.x * sine + local.y * cosine,
  };
}

test("fitting empty and rotated card contents uses visual bounds and stable placement", () => {
  const empty = card("empty", []);
  assert.equal(fitCardToContent(empty), true);
  assert.equal(empty.width, minCardWidth);
  assert.equal(empty.height, minCardHeight);

  const shape = rectangle("shape", 80, 50, Math.PI / 2);
  const value = card("rotated", [shape]);
  const before = localToParent(value, {
    x: shape.x + shape.width / 2,
    y: shape.y + shape.height / 2,
  });
  assert.equal(fitCardToContent(value), true);
  const after = localToParent(value, {
    x: shape.x + shape.width / 2,
    y: shape.y + shape.height / 2,
  });
  assert.ok(Math.abs(before.x - after.x) < 0.000001);
  assert.ok(Math.abs(before.y - after.y) < 0.000001);
  const fittedBounds = canvasVisualBounds.forObjects(value.elements)!;
  assert.ok(fittedBounds.x >= 5.99);
  assert.ok(fittedBounds.y >= 5.99);
  assert.ok(fittedBounds.x + fittedBounds.width <= value.width - 5.99);
  assert.equal(fitCardToContent(value), false);
});

test("fitting includes path strokes, curved arrows, arrowheads, and nested cards", () => {
  const path = new PathObject({
    id: "path",
    type: "path",
    x: -20,
    y: 10,
    width: 60,
    height: 160,
    rotation: 0,
    opacity: 1,
    points: [
      { x: -20, y: 10 },
      { x: 40, y: 170 },
    ],
    color: 0,
    fill: 0,
    stroke: 0,
    strokeWidth: 10,
    fillStyle: "none",
  });
  const arrow = new ArrowObject({
    id: "arrow",
    type: "arrow",
    x: 60,
    y: -30,
    width: 180,
    height: 200,
    rotation: 0,
    opacity: 1,
    start: { point: { x: 60, y: -30 } },
    end: { point: { x: 240, y: 170 } },
    path: {
      type: "curved",
      controls: [
        { along: 0.25, offset: 90 },
        { along: 0.75, offset: 90 },
      ],
    },
    startHead: "chicken",
    endHead: "triangle",
    strokeWidth: 6,
  });
  const nested = card("nested", [rectangle("nested-shape", 10, 10)]);
  nested.rotation = -Math.PI / 8;
  const value = card("mixed", [path, arrow, nested]);
  assert.equal(fitCardToContent(value), true);
  const bounds = canvasVisualBounds.forObjects(value.elements)!;
  assert.ok(bounds.x >= 5.99);
  assert.ok(bounds.y >= 5.99);
  assert.ok(bounds.x + bounds.width <= value.width - 5.99);
  assert.ok(bounds.y + bounds.height <= value.height - 5.99);
});

test("preview cache builds nested cards bottom-up, reuses snapshots, and disposes them", () => {
  const generated: string[][] = [];
  let current: string[] = [];
  let destroys = 0;
  const cache = new CardPreviewCache({
    generateTexture: () => {
      generated.push(current);
      current = [];
      return { destroy: () => destroys++ } as unknown as Texture;
    },
    renderElement: (_target, element) => {
      current.push(element.id);
    },
    renderArrow: (_target, arrow) => {
      current.push(arrow.id);
    },
  });
  const child = card("child", [rectangle("child-shape", 10, 10)]);
  const parent = card("parent", [rectangle("parent-shape", 20, 20), child]);
  cache.textureFor(parent);
  assert.deepEqual(generated, [["child-shape"], ["parent-shape", "child"]]);
  assert.equal(cache.generationCount(), 2);
  cache.textureFor(parent);
  assert.equal(cache.generationCount(), 2);
  cache.invalidate(child);
  cache.textureFor(parent);
  assert.equal(cache.generationCount(), 2);
  cache.invalidate(parent);
  cache.textureFor(parent);
  assert.equal(cache.generationCount(), 4);
  cache.prune([]);
  assert.equal(destroys, 4);
});

test("nested card serialization contains model data only and hydrates recursively", () => {
  const nested = card("nested", [rectangle("shape", 4, 5)]);
  const root = card("root", [nested]);
  const serialized = JSON.stringify({ objects: [root] });
  assert.doesNotMatch(serialized, /texture|preview/i);
  const parsed = JSON.parse(serialized) as { objects: CanvasObject[] };
  const hydrated = canvasObjectFactory.hydrate(parsed.objects[0]) as TextCard;
  assert.equal(hydrated.elements[0] instanceof TextCard, true);
  assert.equal((hydrated.elements[0] as TextCard).elements[0] instanceof RectangleObject, true);
});
