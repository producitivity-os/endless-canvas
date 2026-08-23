import assert from "node:assert/strict";
import test from "node:test";
import { arrowBindingResolver, arrowPathGeometry } from "../src/core/engine/arrows/index.ts";
import { CanvasMarkdownParser } from "../src/core/markdown/markdown-parser.ts";
import { ArrowObject } from "../src/core/model/arrow/arrow.ts";
import { RectangleObject } from "../src/core/model/shapes/rectangle.ts";
import { CanvasMarqueeSelection } from "../src/core/runtime/marquee-selection.ts";
import { CanvasSelectionController, CanvasSelectionState } from "../src/core/runtime/selection.ts";
import { CanvasSelectionMutation } from "../src/core/runtime/selection-mutation.ts";

function rectangle(id: string, x: number, y: number, width = 100, height = 80) {
  return new RectangleObject({
    id,
    type: "rect",
    x,
    y,
    width,
    height,
    rotation: 0,
    opacity: 1,
    fill: 0xffffff,
    stroke: 0,
    strokeWidth: 1,
    fillStyle: "solid",
    cornerRadius: 0,
  });
}

test("arrow endpoints snap to hints and preserve arbitrary relative bindings", () => {
  const host = rectangle("host", 20, 30);
  const snapped = arrowBindingResolver.endpointAt({ x: 121, y: 70 }, [host], 12);
  assert.equal(snapped.endpoint.binding?.hint, "right");
  assert.deepEqual(snapped.endpoint.binding?.anchor, { x: 1, y: 0.5 });

  const relative = arrowBindingResolver.endpointAt({ x: 45, y: 54 }, [host], 4).endpoint;
  assert.equal(relative.binding?.hint, undefined);
  host.translate(50, 10);
  assert.deepEqual(arrowBindingResolver.resolve(relative, [host]), { x: 95, y: 64 });
});

test("between arrows clip to hosts and detach when a host is deleted", () => {
  const from = rectangle("from", 0, 0);
  const to = rectangle("to", 240, 0);
  const arrow = new ArrowObject({
    id: "arrow",
    type: "arrow",
    x: 50,
    y: 40,
    width: 240,
    height: 1,
    rotation: 0,
    opacity: 1,
    start: {
      point: { x: 50, y: 40 },
      binding: { objectId: from.id, anchor: { x: 0.5, y: 0.5 } },
    },
    end: {
      point: { x: 290, y: 40 },
      binding: { objectId: to.id, anchor: { x: 0.5, y: 0.5 } },
    },
    path: { type: "straight" },
    renderMode: "between",
    endHead: "triangle",
  });
  const geometry = arrowPathGeometry.resolve(arrow, [from, to, arrow]);
  assert.ok(geometry.visible[0].x >= from.x + from.width);
  assert.ok(geometry.visible.at(-1)!.x <= to.x);
  assert.ok(geometry.startGuide.length > 1);
  assert.ok(geometry.endGuide.length > 1);

  const selection = new CanvasSelectionController(new CanvasSelectionState());
  const state = { objects: [from, to, arrow] };
  selection.selectObject(from.id);
  assert.equal(new CanvasSelectionMutation(state, selection).deleteSelection(), true);
  assert.equal(arrow.start.binding, undefined);
  assert.deepEqual(arrow.start.point, { x: 50, y: 40 });
  assert.ok(state.objects.includes(arrow));
});

test("marquee uses containment left-to-right and crossing right-to-left", () => {
  const inside = rectangle("inside", 20, 20, 30, 30);
  const crossing = rectangle("crossing", 90, 20, 40, 30);
  const objects = [inside, crossing];
  const selection = new CanvasSelectionController(new CanvasSelectionState());
  const marquee = new CanvasMarqueeSelection();

  marquee.begin({ x: 0, y: 0 }, selection, false);
  marquee.update({ x: 100, y: 100 }, objects, selection);
  assert.deepEqual([...selection.objects], [inside.id]);
  marquee.finish();

  marquee.begin({ x: 100, y: 100 }, selection, false);
  marquee.update({ x: 0, y: 0 }, objects, selection);
  assert.deepEqual(new Set(selection.objects), new Set([inside.id, crossing.id]));
});

test("markdown supports rich text, inert links, inline math, and bad delimiters", () => {
  const parser = new CanvasMarkdownParser(
    (source, unmatched) => `<span class="${unmatched ? "math-error" : "math"}">${source}</span>`,
  );
  const html = parser.render(
    "# Heading\n\n**bold** [docs](https://example.com) $x^2$\n\n`$code$`\n\n- item",
  );
  assert.match(html, /<h1>Heading<\/h1>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /canvas-md-link/);
  assert.doesNotMatch(html, /href=/);
  assert.match(html, /class="math">x\^2<\/span>/);
  assert.match(html, /<code>\$code\$<\/code>/);
  assert.match(html, /<li>item<\/li>/);
  assert.match(parser.render("bad $formula"), /math-error/);
});
