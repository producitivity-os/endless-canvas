import assert from "node:assert/strict";
import test from "node:test";
import {
  CanvasPaneController,
  normalizeMaxPaneDepth,
} from "../src/core/runtime/pane-navigation.ts";
import { CanvasSelectionController, CanvasSelectionState } from "../src/core/runtime/selection.ts";
import { TextCard } from "../src/core/model/card/card.ts";
import { RectangleObject } from "../src/core/model/shapes/rectangle.ts";
import type { CanvasObject } from "../src/core/model/object.ts";
import type { CanvasPaneContext, CanvasViewport } from "../src/core/types/index.ts";

function rectangle(id: string, x = 20, y = 30): RectangleObject {
  return new RectangleObject({
    id,
    type: "rect",
    x,
    y,
    width: 80,
    height: 40,
    rotation: 0,
    opacity: 1,
    fill: 0xffffff,
    stroke: 0x111111,
    strokeWidth: 2,
    fillStyle: "solid",
  });
}

function card(id: string, elements: CanvasObject[] = []): TextCard {
  return new TextCard({
    id,
    type: "card",
    x: 100,
    y: 120,
    width: 220,
    height: 140,
    rotation: 0,
    opacity: 1,
    elements,
  });
}

test("nested panes stage changes, restore navigation state, and notify root once", () => {
  const child = card("child", [rectangle("inside-child")]);
  const parent = card("parent", [rectangle("inside-parent"), child]);
  const rootState = { objects: [parent] as CanvasObject[] };
  const activeState = { objects: rootState.objects };
  const selection = new CanvasSelectionController(new CanvasSelectionState());
  selection.selectObject(parent.id);
  let viewport: CanvasViewport = { x: 17, y: 23, scale: 2 };
  const contexts: CanvasPaneContext[] = [];
  let rootChanges = 0;
  const committed: string[] = [];
  const panes = new CanvasPaneController({
    rootState,
    activeState,
    selection,
    getViewport: () => ({ ...viewport }),
    setViewport: (next) => {
      viewport = { ...next };
    },
    centerViewport: (objects) => {
      viewport = { x: objects.length * 10, y: objects.length * 20, scale: 1 };
    },
    onRootChange: () => rootChanges++,
    onPaneChange: (context) => contexts.push(context),
    onCardCommit: (value) => committed.push(value.id),
  });

  assert.equal(panes.enter(parent), true);
  assert.notEqual(activeState.objects, parent.elements);
  assert.equal(selection.hasSelection, false);
  const workingParentRectangle = activeState.objects[0];
  workingParentRectangle.translate(30, 0);
  panes.markDirty();
  const workingChild = activeState.objects[1] as TextCard;
  selection.selectObject(workingChild.id);
  const parentPaneViewport = { ...viewport };

  assert.equal(panes.enter(workingChild), true);
  activeState.objects.push(rectangle("new-child-object", 200, 180));
  panes.markDirty();
  assert.equal(panes.commitAndExit(), true);
  assert.deepEqual(viewport, parentPaneViewport);
  assert.equal(selection.isSelected(workingChild.id), true);
  assert.equal(rootChanges, 0);
  assert.deepEqual(committed, ["child"]);

  selection.clear();
  assert.equal(panes.commitAndExit(), true);
  assert.deepEqual(viewport, { x: 17, y: 23, scale: 2 });
  assert.equal(selection.isSelected(parent.id), true);
  assert.equal(rootChanges, 1);
  assert.deepEqual(committed, ["child", "parent"]);
  assert.equal((parent.elements[1] as TextCard).elements.length, 2);
  assert.deepEqual(
    contexts.map((context) => [context.stackLevel, [...context.cardPath]]),
    [
      [0, []],
      [1, ["parent"]],
      [2, ["parent", "child"]],
      [1, ["parent"]],
      [0, []],
    ],
  );
});

test("pane depth accepts non-negative integers and Infinity and rejects invalid values", () => {
  assert.equal(normalizeMaxPaneDepth(undefined), 3);
  assert.equal(normalizeMaxPaneDepth(-1), 3);
  assert.equal(normalizeMaxPaneDepth(1.5), 3);
  assert.equal(normalizeMaxPaneDepth(Number.NaN), 3);
  assert.equal(normalizeMaxPaneDepth(0), 0);
  assert.equal(normalizeMaxPaneDepth(Infinity), Infinity);

  const rootCard = card("root-card");
  const state = { objects: [rootCard] as CanvasObject[] };
  const panes = new CanvasPaneController({
    rootState: state,
    activeState: { objects: state.objects },
    selection: new CanvasSelectionController(new CanvasSelectionState()),
    maxPaneDepth: 0,
    getViewport: () => ({ x: 0, y: 0, scale: 1 }),
    setViewport: () => undefined,
    centerViewport: () => undefined,
  });
  assert.equal(panes.enter(rootCard), false);
  assert.deepEqual(panes.context(), {
    stackLevel: 0,
    cardPath: [],
    canGoBack: false,
    maxPaneDepth: 0,
  });
});
