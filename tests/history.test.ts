import assert from "node:assert/strict";
import test from "node:test";
import { CanvasHistoryController } from "../src/core/runtime/history.ts";

test("history records content changes, restores snapshots, and invalidates redo", () => {
  let value = { items: ["a"] };
  const states: Array<{ canUndo: boolean; canRedo: boolean }> = [];
  let restores = 0;
  const history = new CanvasHistoryController({
    capture: () => structuredClone(value),
    restore: (snapshot) => { value = structuredClone(snapshot); },
    onRestore: () => { restores += 1; },
    onStateChange: (state) => states.push(state),
  });

  value.items.push("b");
  assert.equal(history.record(), true);
  assert.deepEqual(history.state, { canUndo: true, canRedo: false });
  assert.equal(history.undo(), true);
  assert.deepEqual(value.items, ["a"]);
  assert.deepEqual(history.state, { canUndo: false, canRedo: true });
  assert.equal(history.redo(), true);
  assert.deepEqual(value.items, ["a", "b"]);
  assert.equal(restores, 2);

  assert.equal(history.undo(), true);
  value.items.push("c");
  assert.equal(history.record(), true);
  assert.deepEqual(history.state, { canUndo: true, canRedo: false });
  assert.equal(history.redo(), false);
  assert.ok(states.length >= 5);
});

test("history ignores no-ops, cancels transactions, and caps undo entries", () => {
  let value = 0;
  const history = new CanvasHistoryController({
    capture: () => value,
    restore: (snapshot) => { value = snapshot; },
    maxEntries: 100,
  });

  assert.equal(history.record(), false);
  history.begin();
  value = 3;
  history.cancel();
  assert.equal(value, 0);
  assert.equal(history.canUndo, false);

  for (let index = 1; index <= 105; index++) {
    value = index;
    history.record();
  }
  let undoCount = 0;
  while (history.undo()) undoCount += 1;
  assert.equal(undoCount, 100);
  assert.equal(value, 5);
});
