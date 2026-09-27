import assert from "node:assert/strict";
import test from "node:test";
import { Container } from "pixi.js";
import { ImageLabelRenderer } from "../src/core/engine/renderers/image-label-renderer.ts";
import { RetainedViewLayer } from "../src/core/engine/renderers/retained-view-layer.ts";
import { MarkdownHtmlCache } from "../src/core/markdown/markdown-html-cache.ts";
import { CanvasMarkdownParser } from "../src/core/markdown/markdown-parser.ts";
import type { CanvasObject } from "../src/core/model/object.ts";
import {
  CANVAS_MIXED_VALUE,
  CanvasPropertyContextBuilder,
  CanvasPropertyDefaults,
  CanvasPropertyMutation,
} from "../src/core/properties/index.ts";

function rectangle(id: string, fill = 0xffffff) {
  return {
    id,
    type: "rect",
    x: 0,
    y: 0,
    width: 100,
    height: 80,
    rotation: 0,
    opacity: 1,
    fill,
    stroke: 0x334155,
    strokeWidth: 2,
    fillStyle: "solid",
    cornerRadius: 8,
  } as CanvasObject & { fill: number; stroke: number; opacity: number };
}

test("tool defaults are validated and retained per creation tool", () => {
  const defaults = new CanvasPropertyDefaults();
  assert.equal(defaults.forTool("image").cornerRadius, 0);
  assert.equal(defaults.apply("text", { format: "markdown", fontSize: 26 }), 2);
  assert.equal(defaults.apply("text", { fontSize: Number.NaN }), 0);
  assert.equal(defaults.forTool("text").format, "markdown");
  assert.equal(defaults.forTool("text").fontSize, 26);
});

test("property contexts expose mixed common values and mutations count objects once", () => {
  const first = rectangle("first", 0xffffff);
  const second = rectangle("second", 0xff0000);
  const defaults = new CanvasPropertyDefaults();
  const context = new CanvasPropertyContextBuilder().build(
    "select",
    [first, second],
    new Set([first.id, second.id]),
    defaults,
  );
  assert.equal(context.mode, "selection");
  assert.equal(context.fields.find((field) => field.name === "fill")?.value, CANVAS_MIXED_VALUE);

  const mutation = new CanvasPropertyMutation();
  assert.equal(mutation.apply([first, second], { fill: 0x123456, opacity: 0.5 }), 2);
  assert.equal(first.fill, 0x123456);
  assert.equal(second.opacity, 0.5);
  assert.equal(mutation.apply([first, second], { opacity: 0.5 }), 0);
});

test("multi-selection only exposes properties supported by every object", () => {
  const shape = rectangle("shape");
  const text = {
    id: "text",
    type: "text",
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    opacity: 1,
    text: "hello",
    format: "plain",
  } as CanvasObject;
  const context = new CanvasPropertyContextBuilder().build(
    "select",
    [shape, text],
    new Set([shape.id, text.id]),
    new CanvasPropertyDefaults(),
  );
  assert.deepEqual(
    context.fields.map((field) => field.name),
    ["opacity"],
  );
});

test("retained layers reconcile containers by id and dispose deleted views", () => {
  const host = new Container();
  const disposed: string[] = [];
  const layer = new RetainedViewLayer<{ id: string }>((_container, value) => {
    disposed.push(value.id);
  });
  layer.reconcile(
    host,
    [{ id: "a" }, { id: "b" }],
    (value) => value.id,
    () => undefined,
  );
  const firstA = host.children[0];
  layer.reconcile(
    host,
    [{ id: "a" }],
    (value) => value.id,
    () => undefined,
  );
  assert.equal(host.children[0], firstA);
  assert.deepEqual(disposed, ["b"]);
  host.destroy({ children: true });
});

test("Markdown parsing is retained and object caches are cleaned after deletion", () => {
  let parses = 0;
  const parser = new CanvasMarkdownParser((source) => source);
  const originalRender = parser.render.bind(parser);
  parser.render = (source: string) => {
    parses++;
    return originalRender(source);
  };
  const cache = new MarkdownHtmlCache(parser);
  cache.htmlForObject("first", "**same**");
  cache.htmlForObject("first", "**same**");
  cache.htmlForObject("second", "**same**");
  assert.equal(parses, 1);

  cache.htmlForObject("first", "changed");
  assert.equal(parses, 2);
  cache.invalidateObject("first");
  cache.invalidateObject("second");
  assert.deepEqual(cache.size(), { objects: 0, sources: 0 });

  cache.htmlForObject("third", "$x$");
  cache.invalidateResolvedLatex();
  cache.htmlForObject("third", "$x$");
  assert.equal(parses, 4);
});

test("image labels shrink below 100%, cap above it, and stay anchored to image corners", () => {
  const renderer = new ImageLabelRenderer();
  for (const scale of [0.25, 1, 3]) {
    const frame = { x: -2 / scale, y: -2 / scale, width: 200 + 4 / scale, height: 100 + 4 / scale };
    const handles = { x: 0, y: 0, width: 200, height: 100 };
    const layout = renderer.layout(frame, handles, scale);
    const expectedScreenScale = Math.min(1, scale);
    assert.equal(layout.screenScale, expectedScreenScale);
    assert.equal(layout.worldScale, expectedScreenScale / scale);
    assert.ok(
      Math.abs((handles.x + handles.width - layout.size.x) * scale - 13 * expectedScreenScale) < 0.000001,
    );
    assert.ok(
      Math.abs((layout.filename.x - handles.x) * scale - 13 * expectedScreenScale) < 0.000001,
    );
    assert.equal(layout.size.y, frame.y);
    assert.equal(layout.filename.y, frame.y + frame.height);
  }
});

test("image labels hide when the projected image is too small", () => {
  const renderer = new ImageLabelRenderer();
  const handles = { x: 0, y: 0, width: 320, height: 59 };
  assert.equal(renderer.layout(handles, handles, 0.7).visible, false);
  assert.equal(renderer.layout(handles, handles, 0.75).visible, true);
  assert.equal(renderer.layout({ ...handles, width: 120 }, handles, 0.75).visible, false);
});
