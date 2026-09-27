import assert from "node:assert/strict";
import test from "node:test";
import { KeyboardShortcutMapper } from "../src/core/interaction/keyboard-shortcut-mapper.ts";
import { CanvasSelectionController, CanvasSelectionState } from "../src/core/runtime/selection.ts";
import { CanvasSelectionMutation } from "../src/core/runtime/selection-mutation.ts";
import {
  CanvasClipboard,
  canvasClipboardText,
  systemClipboardPayloadFromText,
} from "../src/core/runtime/clipboard.ts";
import { ArrowObject } from "../src/core/model/arrow/arrow.ts";
import { IllustrationCard } from "../src/core/model/card/card.ts";
import { RectangleObject } from "../src/core/model/shapes/rectangle.ts";
import { TextObject } from "../src/core/model/text/text.ts";
import { canvasVisualBounds } from "../src/core/engine/visual-bounds.ts";
import { CanvasObjectCapabilityPolicy } from "../src/core/runtime/object-capability-policy.ts";
import { isCanvasUiTarget } from "../src/core/interaction/canvas-ui-target.ts";
import { canvasObjectPointerIsClick } from "../src/core/runtime/pointer-gesture.ts";

class FakeElement {
  isContentEditable = false;
  closest(): null {
    return null;
  }
}
class FakeInput extends FakeElement {}
class FakeTextArea extends FakeElement {}
class FakeSelect extends FakeElement {}
class FakeButton extends FakeElement {}

Object.assign(globalThis, {
  HTMLElement: FakeElement,
  HTMLInputElement: FakeInput,
  HTMLTextAreaElement: FakeTextArea,
  HTMLSelectElement: FakeSelect,
  HTMLButtonElement: FakeButton,
});

function keyboardEvent(
  key: string,
  options: { metaKey?: boolean; ctrlKey?: boolean; target?: EventTarget | null } = {},
): KeyboardEvent {
  return {
    key,
    metaKey: options.metaKey ?? false,
    ctrlKey: options.ctrlKey ?? false,
    target: options.target ?? null,
  } as KeyboardEvent;
}

test("maps delete, selection, clipboard, and cancel shortcuts", () => {
  const mapper = new KeyboardShortcutMapper();
  assert.equal(mapper.actionFor(keyboardEvent("Backspace")), "delete-selection");
  assert.equal(mapper.actionFor(keyboardEvent("Delete")), "delete-selection");
  assert.equal(mapper.actionFor(keyboardEvent("a", { metaKey: true })), "select-all");
  assert.equal(mapper.actionFor(keyboardEvent("A", { ctrlKey: true })), "select-all");
  assert.equal(mapper.actionFor(keyboardEvent("c", { metaKey: true })), "copy-selection");
  assert.equal(mapper.actionFor(keyboardEvent("x", { metaKey: true })), "cut-selection");
  assert.equal(mapper.actionFor(keyboardEvent("v", { ctrlKey: true })), "paste");
  assert.equal(mapper.actionFor(keyboardEvent("z", { metaKey: true })), "undo");
  assert.equal(mapper.actionFor(keyboardEvent("u", { ctrlKey: true })), "redo");
  assert.equal(mapper.actionFor(keyboardEvent("Escape")), "cancel");
  assert.equal(mapper.actionFor(keyboardEvent("Enter")), "commit-interaction");
  assert.equal(mapper.actionFor(keyboardEvent("a")), null);
});

test("suppresses shortcuts for editable controls", () => {
  const mapper = new KeyboardShortcutMapper();
  assert.equal(
    mapper.actionFor(keyboardEvent("Backspace", { target: new FakeInput() as EventTarget })),
    null,
  );
});

test("canvas UI buttons do not enter pointer interactions", () => {
  assert.equal(isCanvasUiTarget(new FakeButton() as unknown as EventTarget), true);
  assert.equal(isCanvasUiTarget(new FakeElement() as unknown as EventTarget), false);
});

test("object clicks tolerate four screen pixels but drags do not", () => {
  assert.equal(canvasObjectPointerIsClick({ x: 10, y: 10 }, { x: 14, y: 10 }), true);
  assert.equal(canvasObjectPointerIsClick({ x: 10, y: 10 }, { x: 13, y: 14 }), false);
});

test("select all includes every runtime object", () => {
  const selection = new CanvasSelectionController(new CanvasSelectionState());
  const state = {
    objects: [{ id: "a" }, { id: "b" }],
  } as never;
  new CanvasSelectionMutation(state, selection).selectAll();
  assert.deepEqual([...selection.objects], ["a", "b"]);
});

test("deleting an object removes only selected runtime objects", () => {
  const selection = new CanvasSelectionController(new CanvasSelectionState());
  const state = {
    objects: [{ id: "a" }, { id: "b" }, { id: "c" }],
  } as never;
  selection.selectObject("b");
  assert.equal(new CanvasSelectionMutation(state, selection).deleteSelection(), true);
  assert.deepEqual(
    state.objects.map(({ id }: { id: string }) => id),
    ["a", "c"],
  );
  assert.equal(selection.hasSelection, false);
});

test("deleting an empty selection is not a mutation", () => {
  const selection = new CanvasSelectionController(new CanvasSelectionState());
  const state = { objects: [] } as never;
  assert.equal(new CanvasSelectionMutation(state, selection).deleteSelection(), false);
});

test("clipboard deeply clones card contents and remaps nested arrow bindings", () => {
  const rectangle = new RectangleObject({
    id: "nested-rect",
    type: "rect",
    x: 4,
    y: 5,
    width: 40,
    height: 30,
  });
  const arrow = new ArrowObject({
    id: "nested-arrow",
    type: "arrow",
    x: 0,
    y: 0,
    width: 50,
    height: 30,
    start: {
      point: { x: 24, y: 20 },
      binding: { objectId: rectangle.id, anchor: { x: 0.5, y: 0.5 } },
    },
    end: { point: { x: 70, y: 40 } },
  });
  const card = new IllustrationCard({
    id: "card",
    type: "card",
    x: 10,
    y: 20,
    width: 200,
    height: 120,
    elements: [rectangle, arrow],
  });
  const clipboard = new CanvasClipboard();
  clipboard.copyElements([card]);
  const [pasted] = clipboard.pasteElements({ x: 100, y: 120 }) as IllustrationCard[];
  const pastedRectangle = pasted.elements[0] as RectangleObject;
  const pastedArrow = pasted.elements[1] as ArrowObject;

  assert.notEqual(pasted.id, card.id);
  assert.notEqual(pastedRectangle.id, rectangle.id);
  assert.notEqual(pastedArrow.id, arrow.id);
  assert.equal(pastedArrow.start.binding?.objectId, pastedRectangle.id);
  pastedRectangle.width = 999;
  assert.equal(rectangle.width, 40);
});

test("clipboard centers a copied selection on the paste anchor", () => {
  const left = new RectangleObject({
    id: "left",
    type: "rect",
    x: 10,
    y: 20,
    width: 40,
    height: 30,
    fill: 0,
    stroke: 0,
  });
  const right = new RectangleObject({
    id: "right",
    type: "rect",
    x: 90,
    y: 70,
    width: 20,
    height: 50,
    fill: 0,
    stroke: 0,
  });
  const clipboard = new CanvasClipboard();
  clipboard.copyElements([left, right]);

  const pasted = clipboard.pasteElements({ x: 300, y: 240 });
  const bounds = canvasVisualBounds.forObjects(pasted)!;

  assert.equal(bounds.x + bounds.width / 2, 300);
  assert.equal(bounds.y + bounds.height / 2, 240);
});

test("consumer object capabilities apply recursively without changing other object types", () => {
  const child = new RectangleObject({
    id: "child",
    type: "rect",
    x: 0,
    y: 0,
    width: 40,
    height: 30,
    fill: 0,
    stroke: 0,
  });
  const nested = new IllustrationCard({
    id: "nested",
    type: "card",
    x: 5,
    y: 5,
    width: 100,
    height: 80,
    elements: [child],
  });
  const root = new IllustrationCard({
    id: "root",
    type: "card",
    x: 10,
    y: 20,
    width: 200,
    height: 120,
    elements: [nested],
  });

  new CanvasObjectCapabilityPolicy({ card: { rotatable: false } }).apply(root);

  assert.equal(root.capabilities.rotatable, false);
  assert.equal(nested.capabilities.rotatable, false);
  assert.equal(child.capabilities.rotatable, true);
});

test("system clipboard exposes text directly and serializes richer canvas selections", () => {
  const text = new TextObject({
    id: "text",
    type: "text",
    x: 0,
    y: 0,
    width: 100,
    height: 30,
    text: "Raw clipboard text",
  });
  const rectangle = new RectangleObject({
    id: "rect",
    type: "rect",
    x: 0,
    y: 0,
    width: 40,
    height: 30,
  });

  assert.equal(canvasClipboardText([text], "token"), "Raw clipboard text");
  const serialized = canvasClipboardText([rectangle, text], "token");
  assert.doesNotMatch(serialized, /canvas selection/i);
  const payload = systemClipboardPayloadFromText(serialized);
  assert.equal(payload.kind, "elements");
  if (payload.kind === "elements") {
    assert.deepEqual(
      payload.elements.map((element) => element.id),
      ["rect", "text"],
    );
    assert.notEqual(payload.elements[0], rectangle);
  }
});

test("clipboard detaches bindings whose targets are outside the copied selection", () => {
  const arrow = new ArrowObject({
    id: "arrow",
    type: "arrow",
    x: 0,
    y: 0,
    width: 50,
    height: 30,
    start: {
      point: { x: 0, y: 0 },
      binding: { objectId: "not-copied", anchor: { x: 0.5, y: 0.5 } },
    },
    end: { point: { x: 50, y: 30 } },
  });
  const clipboard = new CanvasClipboard();
  clipboard.copyElements([arrow]);
  const [pasted] = clipboard.pasteElements() as ArrowObject[];
  assert.equal(pasted.start.binding, undefined);
});
