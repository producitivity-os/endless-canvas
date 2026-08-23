import assert from "node:assert/strict";
import test from "node:test";
import { KeyboardShortcutMapper } from "../src/core/interaction/keyboard-shortcut-mapper.ts";
import { CanvasSelectionController, CanvasSelectionState } from "../src/core/runtime/selection.ts";
import { CanvasSelectionMutation } from "../src/core/runtime/selection-mutation.ts";

class FakeElement {
  isContentEditable = false;
  closest(): null {
    return null;
  }
}
class FakeInput extends FakeElement {}
class FakeTextArea extends FakeElement {}
class FakeSelect extends FakeElement {}

Object.assign(globalThis, {
  HTMLElement: FakeElement,
  HTMLInputElement: FakeInput,
  HTMLTextAreaElement: FakeTextArea,
  HTMLSelectElement: FakeSelect,
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

test("maps delete, select all, and cancel shortcuts", () => {
  const mapper = new KeyboardShortcutMapper();
  assert.equal(mapper.actionFor(keyboardEvent("Backspace")), "delete-selection");
  assert.equal(mapper.actionFor(keyboardEvent("Delete")), "delete-selection");
  assert.equal(mapper.actionFor(keyboardEvent("a", { metaKey: true })), "select-all");
  assert.equal(mapper.actionFor(keyboardEvent("A", { ctrlKey: true })), "select-all");
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
