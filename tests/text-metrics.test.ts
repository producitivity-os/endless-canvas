import assert from "node:assert/strict";
import test from "node:test";
import {
  CanvasTextMetrics,
  type CanvasTextEditorStyle,
} from "../src/core/interaction/text-metrics.ts";
import { CanvasTextCaretMapper } from "../src/core/interaction/text-caret-mapper.ts";
import { canvasObjectFactory } from "../src/core/model/object-factory.ts";
import { TextObject } from "../src/core/model/text/text.ts";

const context = {
  font: "",
  measureText(value: string) {
    return { width: value.length * 10 } as TextMetrics;
  },
};

Object.assign(globalThis, {
  document: {
    createElement(tag: string) {
      assert.equal(tag, "canvas");
      return { getContext: () => context };
    },
  },
});

const style: CanvasTextEditorStyle = {
  fontFamily: "Inter, sans-serif",
  fontSize: 18,
  fontWeight: "400",
  italic: false,
  color: "#172033",
  opacity: 1,
  lineHeight: 24,
  letterSpacing: 0,
  padding: 4,
  textAlign: "left",
};

test("text grows to the longest hard line and full row count", () => {
  const size = new CanvasTextMetrics().measure("short\na much longer line\nlast", style);
  assert.equal(size.width, 190);
  assert.equal(size.height, 80);
});

test("empty text keeps sensible one-line minimum dimensions", () => {
  const size = new CanvasTextMetrics().measure("", style);
  assert.equal(size.width, 80);
  assert.equal(size.height, 32);
});

test("fixed-width text measures wrapped height without changing its width", () => {
  const size = new CanvasTextMetrics().measureFixed("one two three", style, 100);
  assert.equal(size.width, 100);
  assert.equal(size.height, 56);
});

test("clicked text positions map to the nearest multiline caret", () => {
  const mapper = new CanvasTextCaretMapper();
  const index = mapper.indexAt(
    "abc\ndef",
    { x: 26, y: 34 },
    {
      point: { x: 0, y: 0 },
      initialValue: "abc\ndef",
      initialSize: { width: 100, height: 56 },
      scale: 1,
      rotation: 0,
      style,
    },
    { width: 100, height: 56 },
  );
  assert.equal(index, 6);
});

test("text line limits survive canvas serialization and hydration", () => {
  const original = new TextObject({
    id: "two-lines",
    type: "text",
    x: 0,
    y: 0,
    width: 148,
    height: 38,
    text: "A long book title that should occupy no more than two lines",
    fontSize: 15,
    lineHeight: 18,
    maxLines: 2,
    sizing: "fixed",
  });
  const hydrated = canvasObjectFactory.hydrate(JSON.parse(JSON.stringify(original))) as TextObject;
  assert.equal(hydrated.maxLines, 2);
  assert.equal(hydrated.lineHeight, 18);
});

test("markdown source bounds survive independently from rendered bounds", () => {
  const original = new TextObject({
    id: "formula",
    type: "text",
    x: 0,
    y: 0,
    width: 124,
    height: 72,
    sourceWidth: 360,
    sourceHeight: 144,
    text: "$$\\frac{a}{b}$$",
    format: "markdown",
  });
  const hydrated = canvasObjectFactory.hydrate(JSON.parse(JSON.stringify(original))) as TextObject;
  assert.equal(hydrated.width, 124);
  assert.equal(hydrated.height, 72);
  assert.equal(hydrated.sourceWidth, 360);
  assert.equal(hydrated.sourceHeight, 144);
});
