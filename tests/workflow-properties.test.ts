import assert from "node:assert/strict";
import test from "node:test";
import { Container, Graphics, Text } from "pixi.js";
import { ArrowObject } from "../src/core/model/arrow/arrow.ts";
import type { CanvasObject } from "../src/core/model/object.ts";
import { CanvasHistoryController } from "../src/core/runtime/history.ts";
import { CanvasObjectExtensionRegistry } from "../src/core/runtime/object-extension-registry.ts";
import type { WorkflowNode } from "../../../apps/Workflows/src/features/workflow/nodes/index.ts";
import { WorkflowNodePropertySelection } from "../../../apps/Workflows/src/features/workflow/nodes/properties.ts";
import { WorkflowNodeActivation } from "../../../apps/Workflows/src/features/workflow/nodes/task/activation.ts";
import {
  hydrateWorkflowNode,
  MAX_TIMER_DURATION_MS,
  MIN_TIMER_DURATION_MS,
  WorkflowTimerNode,
  WorkflowTaskNode,
  WorkflowTerminatorNode,
} from "../../../apps/Workflows/src/features/workflow/nodes/index.ts";
import { workflowNodeExtension } from "../../../apps/Workflows/src/features/workflow/nodes/canvas-extension.ts";
import { workflowTaskLayout } from "../../../apps/Workflows/src/features/workflow/nodes/task/layout.ts";
import { WorkflowNodeRenderer } from "../../../apps/Workflows/src/features/workflow/nodes/renderer.ts";
import { WORKFLOW_NODE_CATALOG } from "../../../apps/Workflows/src/features/workflow/nodes/catalog.ts";
import { PermanentConnectionHandleRenderer } from "../src/core/engine/renderers/permanent-connection-handle-renderer.ts";
import { EndlessCanvasRuntimeState } from "../src/core/types/runtime.ts";
import { setWorkflowObjectsProvider } from "../../../apps/Workflows/src/features/workflow/nodes/terminator/reset.ts";

const common = (id: string) => ({
  id,
  layerId: "main",
  type: "workflow-node" as const,
  x: 0,
  y: 0,
  width: 200,
  height: 90,
  rotation: 0,
  opacity: 1,
  capabilities: {},
});

const connectedObjects = (node: WorkflowNode): CanvasObject[] => {
  const start = new WorkflowTerminatorNode({ ...common(`start-${node.id}`), role: "Start", name: "Start" });
  return [start, node, new ArrowObject({
    id: `edge-${node.id}`,
    layerId: "main",
    type: "arrow",
    x: 0,
    y: 0,
    width: 100,
    height: 1,
    start: { point: { x: 0, y: 0 }, binding: { objectId: start.id, anchor: { x: 1, y: 0.5 } } },
    end: { point: { x: 100, y: 0 }, binding: { objectId: node.id, anchor: { x: 0, y: 0.5 } } },
  })];
};

function nodes() {
  return {
    terminator: {
      ...common("terminator"),
      nodeKind: "terminator",
      role: "Start",
      name: "Start",
      description: "Begin",
    },
    task: {
      ...common("task"),
      nodeKind: "task",
      name: "Task",
      description: "Details",
      completed: false,
      subtasks: [],
    },
    timer: {
      ...common("timer"),
      nodeKind: "timer",
      name: "Timer",
      description: "Focus",
      durationMs: 1_500_000,
      elapsedMs: 0,
      startedAt: null,
      timerStatus: "idle",
    },
    milestone: {
      ...common("milestone"),
      nodeKind: "milestone",
      name: "Milestone",
      description: "Gate",
      status: "blocked",
    },
    link: {
      ...common("link"),
      nodeKind: "link",
      name: "Next",
      description: "Continue",
      targetCanvasId: "workflow-2",
      targetCanvasTitle: "Workflow 2",
    },
  } as unknown as Record<
    "terminator" | "task" | "timer" | "milestone" | "link",
    WorkflowNode
  >;
}

test("every workflow node kind exposes its logical property form", () => {
  const values = nodes();
  assert.deepEqual(WorkflowNodePropertySelection.from([values.terminator])?.fields, [
    "role",
    "name",
  ]);
  assert.deepEqual(WorkflowNodePropertySelection.from([values.task])?.fields, [
    "name",
    "subtasks",
  ]);
  assert.deepEqual(WorkflowNodePropertySelection.from([values.timer])?.fields, [
    "name",
    "duration",
  ]);
  assert.deepEqual(WorkflowNodePropertySelection.from([values.milestone])?.fields, [
    "name",
    "status",
  ]);
  assert.deepEqual(WorkflowNodePropertySelection.from([values.link])?.fields, [
    "label",
    "destination",
  ]);
});

test("the workflow creation catalog exposes the Timer node", () => {
  const item = WORKFLOW_NODE_CATALOG.find((candidate) => candidate.kind === "timer");
  assert.equal(item?.title, "Timer");
  assert.match(item?.detail ?? "", /timed/i);
});

test("empty and mixed workflow selections do not produce a single-kind property target", () => {
  const values = nodes();
  assert.equal(WorkflowNodePropertySelection.from([]), null);
  assert.equal(WorkflowNodePropertySelection.from([values.task, values.milestone]), null);
  const sameKind = WorkflowNodePropertySelection.from([
    values.task,
    { ...values.task, id: "task-2", name: "Other" } as WorkflowNode,
  ]);
  assert.equal(sameKind?.nodeKind, "task");
  assert.equal(
    sameKind?.common((node) => node.name),
    undefined,
  );
});

test("workflow property patches update selected nodes immediately", () => {
  const task = nodes().task;
  const selection = WorkflowNodePropertySelection.from([task]);
  assert.ok(selection);
  selection.patch(
    (id, patch) => {
      assert.equal(id, task.id);
      Object.assign(task, patch);
      return true;
    },
    { name: "Updated" },
  );
  assert.equal(task.name, "Updated");
});

test("workflow properties persist through the JSON serialization used by snapshots", () => {
  for (const node of Object.values(nodes())) {
    const payload = JSON.parse(JSON.stringify(node)) as WorkflowNode;
    assert.deepEqual(payload, node);
  }
});

test("workflow activation completes any task reachable from Start", () => {
  const values = nodes();
  const updated: string[] = [];
  const activation = new WorkflowNodeActivation(
    () => connectedObjects(values.task),
    (updates) => {
      for (const { objectId, patch } of updates) {
        const node = Object.values(values).find((candidate) => candidate.id === objectId);
        if (!node) continue;
        Object.assign(node, patch);
        updated.push(objectId);
      }
      return updates.length;
    },
  );
  assert.equal(activation.activate(values.task), true);
  assert.equal(values.task.completed, true);
  for (const node of [
    values.terminator,
    values.timer,
    values.milestone,
    values.link,
  ]) {
    assert.equal(activation.activate(node), false);
  }
  assert.deepEqual(updated, [values.task.id]);
  const connectedTask = new WorkflowTaskNode({
    ...common("connected-task"),
    name: "Connected task",
  });
  const connectedTaskObjects = connectedObjects(connectedTask);
  assert.equal(
    new WorkflowNodeActivation(
      () => connectedTaskObjects,
      (updates) => {
        for (const { objectId, patch } of updates) {
          const object = connectedTaskObjects.find((candidate) => candidate.id === objectId);
          if (object) Object.assign(object, patch);
        }
        return updates.length;
      },
    ).activate(connectedTask),
    true,
  );
  const disconnected = new WorkflowTaskNode({ ...common("disconnected"), name: "Disconnected" });
  assert.equal(new WorkflowNodeActivation(() => [disconnected], () => 1).activate(disconnected), false);
});

test("workflow activation leaves tasks with subtasks to their derived completion", () => {
  const task = new WorkflowTaskNode({
    ...common("parent-task"),
    name: "Parent",
    completed: true,
    subtasks: [{ id: "child", name: "Child", completed: false }],
  });
  const objects = connectedObjects(task);
  const activation = new WorkflowNodeActivation(
    () => [task],
    () => 1,
  );
  assert.equal(task.completed, false);
  assert.equal(activation.activate(task), false);
});

test("legacy starts and notes hydrate as ordinary terminators and descriptions", () => {
  const legacyStart = hydrateWorkflowNode({
    ...common("legacy-start"),
    nodeKind: "start",
    name: "Custom launch",
    note: "Legacy detail",
  } as unknown as CanvasObject);
  assert.ok(legacyStart instanceof WorkflowTerminatorNode);
  assert.equal(legacyStart.nodeKind, "terminator");
  assert.equal(legacyStart.role, "Start");
  assert.equal(legacyStart.name, "Custom launch");
  assert.equal(legacyStart.description, "Legacy detail");
  assert.equal(legacyStart.capabilities.deletable, true);
  assert.equal(legacyStart.capabilities.copyable, true);

  const task = hydrateWorkflowNode({
    ...common("legacy-task"),
    nodeKind: "task",
    name: "Task",
    note: "Migrated",
  } as unknown as CanvasObject);
  assert.equal(task.description, "Migrated");
  assert.deepEqual((task as WorkflowTaskNode).subtasks, []);
});

test("task hydration clones subtasks, derives completion, and preserves extra height", () => {
  const subtasks = [
    { id: "one", name: "One", completed: true },
    { id: "two", name: "Two", completed: true },
  ];
  const task = hydrateWorkflowNode({
    ...common("hydrated-task"),
    nodeKind: "task",
    completed: false,
    subtasks,
    height: 180,
  } as unknown as CanvasObject) as WorkflowTaskNode;
  assert.equal(task.completed, true);
  assert.equal(task.height, 180);
  assert.notEqual(task.subtasks, subtasks);
  assert.notEqual(task.subtasks[0], subtasks[0]);
  assert.deepEqual(JSON.parse(JSON.stringify(task)).subtasks, subtasks);
});

test("task layout grows for every subtask and extension regions toggle one row", () => {
  const task = new WorkflowTaskNode({
    ...common("subtask-task"),
    name: "Task",
    height: 64,
    subtasks: [
      { id: "one", name: "One", completed: false },
      { id: "two", name: "Two", completed: false },
    ],
  });
  assert.equal(task.height, workflowTaskLayout.minimumHeightFor(2));
  assert.deepEqual(workflowNodeExtension.minimumSize?.(task), {
    width: 120,
    height: workflowTaskLayout.minimumHeightFor(2),
  });
  const objects = connectedObjects(task);
  setWorkflowObjectsProvider(() => objects);
  try {
    assert.deepEqual(workflowNodeExtension.pointerInteractionRegions?.(task), [
      { id: "task:add-subtask", bounds: workflowTaskLayout.addBounds(task.width, true), cursor: "pointer" },
      { id: "task:toggle-subtasks", bounds: workflowTaskLayout.collapseBounds(task.width), cursor: "pointer" },
      { id: "subtask:one", bounds: workflowTaskLayout.checkboxBounds(0), cursor: "pointer" },
      { id: "subtask:two", bounds: workflowTaskLayout.checkboxBounds(1), cursor: "pointer" },
    ]);
  } finally {
    setWorkflowObjectsProvider(null);
  }
  assert.equal(workflowNodeExtension.onPointerInteraction?.(task, "subtask:two", objects), true);
  assert.equal(task.subtasks[1].completed, true);
  assert.equal(task.completed, false);
  assert.equal(workflowNodeExtension.onPointerInteraction?.(task, "subtask:one", objects), true);
  assert.equal(task.completed, true);
});

test("subtask interaction regions account for rotation and cancel outside the checkbox", () => {
  const task = new WorkflowTaskNode({
    ...common("rotated-task"),
    x: 40,
    y: 60,
    rotation: Math.PI / 2,
    name: "Task",
    subtasks: [{ id: "one", name: "One", completed: false }],
  });
  const registry = new CanvasObjectExtensionRegistry([workflowNodeExtension]);
  const local = workflowTaskLayout.checkboxBounds(0);
  const localCenter = { x: local.x + local.width / 2, y: local.y + local.height / 2 };
  const center = { x: task.x + task.width / 2, y: task.y + task.height / 2 };
  const world = {
    x: center.x - (localCenter.y - task.height / 2),
    y: center.y + (localCenter.x - task.width / 2),
  };
  assert.equal(registry.hitPointerInteractionRegion([task], world)?.region.id, "subtask:one");
  assert.equal(registry.hitPointerInteractionRegion([task], { x: task.x, y: task.y }), null);
});

test("a subtask toggle records exactly one undoable history entry", () => {
  let task = new WorkflowTaskNode({
    ...common("history-task"),
    name: "Task",
    subtasks: [{ id: "one", name: "One", completed: false }],
  });
  const objects = connectedObjects(task);
  const history = new CanvasHistoryController({
    capture: () => structuredClone(task),
    restore: (snapshot) => {
      task = hydrateWorkflowNode(snapshot as CanvasObject) as WorkflowTaskNode;
    },
  });
  assert.equal(workflowNodeExtension.onPointerInteraction?.(task, "subtask:one", objects), true);
  assert.equal(history.record(), true);
  assert.deepEqual(history.state, { canUndo: true, canRedo: false });
  assert.equal(history.undo(), true);
  assert.equal(task.subtasks[0].completed, false);
  assert.equal(history.undo(), false);
  assert.equal(history.redo(), true);
  assert.equal(task.subtasks[0].completed, true);
});

test("task renderer has a circular standalone checkbox and a divided collapsible subtask list", () => {
  const renderer = new WorkflowNodeRenderer();
  const standalone = new WorkflowTaskNode({ ...common("flat-task"), name: "Task" });
  const standaloneTarget = new Container();
  renderer.render(standaloneTarget, standalone, {
    scale: 1,
    hovered: false,
    selected: false,
    interactionColor: 0x3b82f6,
  });
  assert.equal((standaloneTarget.children[0] as Container).children.length, 3);

  const task = new WorkflowTaskNode({
    ...common("rendered-subtasks"),
    name: "Task",
    subtasks: [
      { id: "one", name: "One", completed: false },
      { id: "two", name: "Two", completed: false },
    ],
  });
  const target = new Container();
  renderer.render(target, task, {
    scale: 1,
    hovered: false,
    selected: false,
    interactionColor: 0x3b82f6,
  });
  const unselectedRoot = target.children[0] as Container;
  assert.equal(unselectedRoot.children.length, 8);

  const selectedTarget = new Container();
  renderer.render(selectedTarget, task, {
    scale: 1,
    hovered: false,
    selected: true,
    interactionColor: 0x3b82f6,
  });
  const selectedRoot = selectedTarget.children[0] as Container;
  const subtaskLabels = (root: Container) => root.children
    .filter((child): child is Text => child instanceof Text && child.text !== task.name)
    .map((label) => ({ text: label.text, x: label.x, y: label.y }));
  assert.deepEqual(subtaskLabels(selectedRoot), subtaskLabels(unselectedRoot));

  const firstSubtaskLabelIndex = unselectedRoot.children.findIndex(
    (child) => child instanceof Text && child.text === "One",
  );
  const uncheckedCheckbox = unselectedRoot.children[firstSubtaskLabelIndex - 1] as unknown as {
    context: { instructions: Array<{ action: string; data: { style: { color: number } } }> };
  };
  assert.equal(
    uncheckedCheckbox.context.instructions.find((instruction) => instruction.action === "fill")?.data.style.color,
    0xffffff,
  );
  assert.equal(
    uncheckedCheckbox.context.instructions.find((instruction) => instruction.action === "stroke")?.data.style.color,
    0x3b82f6,
  );
});

test("completed tasks use a subdued gray surface and muted text", () => {
  const task = new WorkflowTaskNode({ ...common("completed-task"), name: "Done", completed: true });
  const target = new Container();
  new WorkflowNodeRenderer().render(target, task, {
    scale: 1,
    hovered: false,
    selected: false,
    interactionColor: 0x3b82f6,
  });
  const root = target.children[0] as Container;
  const surface = root.children[0] as unknown as {
    context: { instructions: Array<{ action: string; data: { style: { color: number } } }> };
  };
  const checkbox = root.children[1] as unknown as {
    context: { instructions: Array<{ action: string; data: { style: { color: number } } }> };
  };
  const checkmark = root.children[2] as unknown as {
    context: { instructions: Array<{ action: string; data: { style: { color: number } } }> };
  };
  const label = root.children.find((child): child is Text => child instanceof Text)! as unknown as { style: { _originalFill: number } };
  assert.equal(root.alpha, 1);
  assert.equal(
    surface.context.instructions.find((instruction) => instruction.action === "fill")?.data.style
      .color,
    0xf1f3f5,
  );
  assert.equal(
    checkbox.context.instructions.find((instruction) => instruction.action === "fill")?.data.style.color,
    0x3b82f6,
  );
  assert.equal(
    checkbox.context.instructions.find((instruction) => instruction.action === "stroke")?.data.style.color,
    0x3b82f6,
  );
  assert.equal(
    checkmark.context.instructions.find((instruction) => instruction.action === "stroke")?.data.style.color,
    0xffffff,
  );
  assert.equal(label.style._originalFill, 0x8a94a3);
});

test("permanent workflow endpoints render after the body inside their parent object view", () => {
  const task = new WorkflowTaskNode({ ...common("endpoint-task"), name: "Task" });
  const runtime = {
    arrowPreview: null,
    arrowHintObjectId: null,
    arrowHotHint: null,
  } as EndlessCanvasRuntimeState;
  const objectView = new Container();
  const body = new Container();
  objectView.addChild(body);
  const renderer = new PermanentConnectionHandleRenderer([workflowNodeExtension]);
  renderer.render(objectView, task, runtime, 1);
  assert.equal(objectView.children[0], body);
  assert.equal((objectView.children[1] as Container).children.length, 2);
});

test("selected workflow endpoints render after their object-local outline", () => {
  const task = new WorkflowTaskNode({ ...common("selected-endpoint-task"), name: "Task" });
  const runtime = new EndlessCanvasRuntimeState();
  runtime.selection.objects.add(task.id);
  runtime.selection.primaryObjectId = task.id;
  const objectView = new Container();
  const body = new Container();
  objectView.addChild(body);
  const renderer = new PermanentConnectionHandleRenderer([workflowNodeExtension]);
  renderer.render(objectView, task, runtime, 1);
  const chrome = objectView.children[1] as Container;
  assert.equal(chrome.children.length, 3);
  assert.equal(chrome.children[0] instanceof Container, true);
  assert.equal(chrome.children[1] instanceof Graphics, true);
  assert.equal(chrome.children[2] instanceof Graphics, true);
});

test("workflow nodes expose only their defined logical connection points", () => {
  const values = nodes();
  assert.deepEqual(workflowNodeExtension.connectionHandles?.(values.task), [
    { hint: "left", anchor: { x: 0, y: 0.5 }, direction: "input", shape: "rounded-rectangle" },
    { hint: "right", anchor: { x: 1, y: 0.5 }, direction: "output", shape: "rounded-rectangle" },
  ]);
  assert.deepEqual(workflowNodeExtension.connectionHandles?.(values.terminator), [
    { hint: "right", anchor: { x: 1, y: 0.5 }, direction: "output", shape: "rounded-rectangle" },
  ]);
  assert.deepEqual(workflowNodeExtension.selectionGeometry?.(values.terminator), {
    shape: "ellipse",
    strokeWidth: 1.5,
    strokeColor: 0x60a5fa,
  });
  (values.terminator as WorkflowTerminatorNode).role = "End";
  assert.deepEqual(workflowNodeExtension.connectionHandles?.(values.terminator), [
    { hint: "left", anchor: { x: 0, y: 0.5 }, direction: "input", shape: "rounded-rectangle" },
  ]);
  assert.deepEqual(workflowNodeExtension.selectionGeometry?.(values.terminator), {
    shape: "rectangle",
    radius: 28,
    strokeWidth: 1.5,
    strokeColor: 0x60a5fa,
  });
  assert.deepEqual(workflowNodeExtension.selectionGeometry?.(values.task), {
    shape: "rectangle",
    radius: 20,
    strokeWidth: 1.5,
    strokeColor: 0x60a5fa,
  });
});

test("timer hydration clamps duration and preserves wall-clock timer state", () => {
  const timer = hydrateWorkflowNode({
    ...common("timer"),
    nodeKind: "timer",
    durationMs: 30 * 60_000,
    elapsedMs: 12_000,
    startedAt: 1_000,
    timerStatus: "running",
  } as unknown as CanvasObject) as WorkflowTimerNode;
  assert.equal(timer.durationMs, 30 * 60_000);
  assert.equal(timer.elapsedMs, 12_000);
  assert.equal(timer.startedAt, 1_000);
  assert.equal(timer.timerStatus, "running");
  assert.deepEqual(workflowNodeExtension.minimumSize?.(timer), { width: 200, height: 64 });
  assert.equal(
    new WorkflowTimerNode({ ...common("short-timer"), durationMs: 1 }).durationMs,
    MIN_TIMER_DURATION_MS,
  );
  assert.equal(
    new WorkflowTimerNode({
      ...common("long-timer"),
      durationMs: Number.MAX_SAFE_INTEGER,
    }).durationMs,
    MAX_TIMER_DURATION_MS,
  );
});

test("timer renderer uses shared solid blue progress with clipped white contents", () => {
  const timer = new WorkflowTimerNode({
    ...common("visible-timer"),
    name: "Focus",
    width: 260,
    height: 88,
    durationMs: 60_000,
    elapsedMs: 30_000,
    startedAt: Date.now(),
    timerStatus: "running",
  });
  const target = new Container();
  new WorkflowNodeRenderer().render(target, timer, {
    scale: 0.5,
    hovered: false,
    selected: false,
    interactionColor: 0x3b82f6,
  });
  const root = target.children[0] as Container;
  const progress = root.children.find((child) => child instanceof Graphics && child.mask != null) as unknown as {
    context: { instructions: Array<{ action: string; data: { style: { color: number } } }> };
  };
  const progressLayer = root.children.find(
    (child): child is Container => child instanceof Container && !(child instanceof Graphics) && child.mask != null,
  );
  const outlines = root.children.filter((child): child is Graphics => child instanceof Graphics);
  const activeOutline = outlines.find((outline) => outline.context.instructions.some(
    (instruction) => instruction.action === "stroke" && instruction.data.style.color === 0x3b82f6 && instruction.data.style.width === 2,
  )) as unknown as {
    context: {
      instructions: Array<{ action: string; data: { style: { color: number; width: number } } }>;
    };
  };
  assert.equal(
    progress.context.instructions.find((instruction) => instruction.action === "fill")?.data.style
      .color,
    0x3b82f6,
  );
  assert.ok(progressLayer?.mask);
  assert.deepEqual(
    progressLayer?.children.filter((child): child is Text => child instanceof Text).map((text) => text.style.fill),
    [0xffffff, 0xffffff, 0xffffff],
  );
  const stroke = activeOutline.context.instructions.find(
    (instruction) => instruction.action === "stroke",
  )?.data.style;
  assert.equal(stroke?.color, 0x3b82f6);
  assert.equal(stroke?.width, 2);
});

test("timer progress inversion covers idle, running, paused, and completed states", () => {
  const cases = [
    { status: "idle" as const, elapsedMs: 0, startedAt: null, expectsProgress: false },
    { status: "running" as const, elapsedMs: 15_000, startedAt: Date.now(), expectsProgress: true },
    { status: "paused" as const, elapsedMs: 30_000, startedAt: null, expectsProgress: true },
    { status: "completed" as const, elapsedMs: 60_000, startedAt: null, expectsProgress: true },
  ];
  for (const item of cases) {
    const timer = new WorkflowTimerNode({
      ...common(`timer-${item.status}`),
      width: 260,
      height: 88,
      durationMs: 60_000,
      elapsedMs: item.elapsedMs,
      startedAt: item.startedAt,
      timerStatus: item.status,
    });
    const target = new Container();
    new WorkflowNodeRenderer().render(target, timer, {
      scale: 1,
      hovered: true,
      selected: false,
      hoveredRegionId: "timer:toggle",
      interactionColor: 0x3b82f6,
    });
    const root = target.children[0] as Container;
    const progressLayer = root.children.find(
      (child): child is Container => child instanceof Container && !(child instanceof Graphics) && child.mask != null,
    );
    assert.equal(Boolean(progressLayer), item.expectsProgress, item.status);
    if (progressLayer) {
      const inverseLabels = progressLayer.children.filter(
        (child): child is Text => child instanceof Text,
      );
      assert.equal(inverseLabels.length, 3);
      assert.ok(inverseLabels.every((label) => label.style.fill === 0xffffff));
    }
    const blueStroke = root.children.some((child) => child instanceof Graphics && child.context.instructions.some(
      (instruction) => instruction.action === "stroke" && instruction.data.style.color === 0x3b82f6,
    ));
    assert.equal(blueStroke, true);
  }
});

test("timer play control only changes Start-connected timers", () => {
  const timer = new WorkflowTimerNode({
    ...common("interactive-timer"),
    width: 260,
    height: 88,
    durationMs: 60_000,
    elapsedMs: 20_000,
    startedAt: null,
    timerStatus: "paused",
  });
  const connected = connectedObjects(timer);
  assert.equal(
    workflowNodeExtension.onPointerInteraction?.(timer, "timer:toggle", connected),
    true,
  );
  assert.equal(timer.timerStatus, "running");
  assert.ok(timer.startedAt);

  // Disconnected nodes do not accept runtime actions, even if they were active
  // before the graph changed.
  assert.equal(
    workflowNodeExtension.onPointerInteraction?.(timer, "timer:toggle", [timer]),
    false,
  );
  assert.equal(timer.timerStatus, "running");
});
