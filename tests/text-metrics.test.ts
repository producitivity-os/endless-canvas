import assert from "node:assert/strict";
import test from "node:test";
import {
  CanvasTextMetrics,
  type CanvasTextEditorStyle,
} from "../src/core/interaction/text-metrics.ts";
import { CanvasTextCaretMapper } from "../src/core/interaction/text-caret-mapper.ts";

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
