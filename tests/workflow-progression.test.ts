import assert from "node:assert/strict";
import test from "node:test";
import { ArrowObject } from "../src/core/model/arrow/arrow.ts";
import type { CanvasObject } from "../src/core/model/object.ts";
import {
  WorkflowTimerNode,
  WorkflowPluginNode,
  WorkflowTaskNode,
  WorkflowTerminatorNode,
} from "../../../apps/Workflows/src/features/workflow/nodes/index.ts";
import {
  applyWorkflowUpdates,
  nextExecutableWorkflowNodes,
  workflowEntryNodes,
  workflowCompletionUpdates,
  workflowNodeCanExecute,
  workflowNodeCanInteract,
} from "../../../apps/Workflows/src/features/workflow/nodes/progression.ts";
import {
  expiredTimerUpdates,
  normalizeTimerUpdates,
  timerElapsed,
  toggleTimerUpdates,
} from "../../../apps/Workflows/src/features/workflow/nodes/timer/lifecycle.ts";
import { WorkflowNodeActivation } from "../../../apps/Workflows/src/features/workflow/nodes/task/activation.ts";
import { workflowNodeExtension } from "../../../apps/Workflows/src/features/workflow/nodes/canvas-extension.ts";
import {
  dueWorkflowResetUpdates,
  setWorkflowObjectsProvider,
  workflowCanReset,
  workflowResetIsDue,
} from "../../../apps/Workflows/src/features/workflow/nodes/terminator/reset.ts";
import { setWorkflowPluginResetter } from "../../../apps/Workflows/src/features/workflow/nodes/plugin/reset-bridge.ts";
import {
  activateWorkflowPluginInteraction,
  setWorkflowPluginActionHandler,
} from "../../../apps/Workflows/src/features/workflow/nodes/plugin/interaction-bridge.ts";

const common = (id: string) => ({
  id,
  layerId: "main",
  type: "workflow-node" as const,
  x: 0,
  y: 0,
  width: 260,
  height: 88,
  rotation: 0,
  opacity: 1,
  capabilities: {},
});

const task = (id: string, completed = false) =>
  new WorkflowTaskNode({
    ...common(id),
    name: id,
    completed,
  });

const timer = (id: string, values: Partial<WorkflowTimerNode> = {}) =>
  new WorkflowTimerNode({
    ...common(id),
    name: id,
    durationMs: 60_000,
    ...values,
  });

const arrow = (id: string, from: string | null, to: string | null) =>
  new ArrowObject({
    id,
    layerId: "main",
    type: "arrow",
    x: 0,
    y: 0,
    width: 100,
    height: 1,
    start: {
      point: { x: 0, y: 0 },
      binding: from ? { objectId: from, anchor: { x: 1, y: 0.5 } } : null,
    },
    end: {
      point: { x: 100, y: 0 },
      binding: to ? { objectId: to, anchor: { x: 0, y: 0.5 } } : null,
    },
  });

test("completion advances every outgoing branch in one patch set", () => {
  const start = new WorkflowTerminatorNode({ ...common("start"), role: "Start", name: "Start" });
  const source = task("source");
  const left = task("left");
  const right = timer("right");
  const objects: CanvasObject[] = [
    start,
    source,
    left,
    right,
    arrow("start-source", start.id, source.id),
    arrow("left-edge", source.id, left.id),
    arrow("right-edge", source.id, right.id),
  ];
  const updates = workflowCompletionUpdates(objects, source.id, {
    completed: true,
  } as Partial<CanvasObject>);
  applyWorkflowUpdates(objects, updates);
  assert.equal(source.completed, true);
  assert.deepEqual(
    workflowEntryNodes(objects).map((node) => node.id),
    [left.id, right.id],
  );
});

test("progression skips completed nodes, ignores loose edges, and protects cycles", () => {
  const source = task("source");
  const skipped = task("skipped", true);
  const target = task("target");
  const objects: CanvasObject[] = [
    source,
    skipped,
    target,
    arrow("source-skipped", source.id, skipped.id),
    arrow("skipped-source", skipped.id, source.id),
    arrow("skipped-target", skipped.id, target.id),
    arrow("loose", source.id, null),
  ];
  assert.deepEqual(
    nextExecutableWorkflowNodes(objects, source.id).map((node) => node.id),
    [target.id],
  );
});

test("workflow entry nodes are derived from Start and completion state", () => {
  const start = new WorkflowTerminatorNode({ ...common("start"), role: "Start", name: "Start" });
  const first = task("first");
  const objects: CanvasObject[] = [start, first, arrow("start-first", start.id, first.id)];
  assert.deepEqual(workflowEntryNodes(objects).map((node) => node.id), [first.id]);
  first.completed = true;
  assert.deepEqual(workflowEntryNodes(objects), []);
  assert.deepEqual(workflowEntryNodes([task("disconnected")]), []);
});

test("every Start-connected node can be used before its predecessors complete", () => {
  const start = new WorkflowTerminatorNode({ ...common("start"), role: "Start", name: "Start" });
  const first = task("first");
  const downstreamTask = task("downstream-task");
  const downstreamTimer = timer("downstream-timer");
  const disconnected = timer("disconnected");
  const objects: CanvasObject[] = [
    start,
    first,
    downstreamTask,
    downstreamTimer,
    disconnected,
    arrow("start-first", start.id, first.id),
    arrow("first-task", first.id, downstreamTask.id),
    arrow("task-timer", downstreamTask.id, downstreamTimer.id),
  ];

  assert.equal(workflowNodeCanExecute(objects, downstreamTask.id), false);
  assert.equal(workflowNodeCanInteract(objects, downstreamTask.id), true);
  assert.equal(workflowNodeCanInteract(objects, downstreamTimer.id), true);
  assert.equal(workflowNodeCanInteract(objects, disconnected.id), false);

  const activation = new WorkflowNodeActivation(
    () => objects,
    (updates) => applyWorkflowUpdates(objects, updates),
  );
  assert.equal(activation.activate(downstreamTask), true);
  assert.equal(downstreamTask.completed, true);
  assert.equal(first.completed, false);
  assert.deepEqual(workflowEntryNodes(objects).map((node) => node.id), [first.id]);

  applyWorkflowUpdates(objects, toggleTimerUpdates(objects, downstreamTimer.id, 1_000));
  assert.equal(downstreamTimer.timerStatus, "running");
  assert.deepEqual(toggleTimerUpdates(objects, disconnected.id, 1_000), []);
});

test("plugin actions dispatch when downstream and stay blocked when disconnected", () => {
  const start = new WorkflowTerminatorNode({ ...common("start"), role: "Start", name: "Start" });
  const unfinished = task("unfinished");
  const connected = new WorkflowPluginNode({
    ...common("connected-review"),
    pluginId: "workflows.revise-nodes",
    pluginNodeType: "timed-revision",
  });
  const disconnected = new WorkflowPluginNode({
    ...common("disconnected-review"),
    pluginId: "workflows.revise-nodes",
    pluginNodeType: "timed-revision",
  });
  const objects: CanvasObject[] = [
    start,
    unfinished,
    connected,
    disconnected,
    arrow("start-task", start.id, unfinished.id),
    arrow("task-review", unfinished.id, connected.id),
  ];
  const activated: string[] = [];
  setWorkflowPluginActionHandler((node) => activated.push(node.id));
  try {
    activateWorkflowPluginInteraction(connected, "revise:toggle", objects);
    activateWorkflowPluginInteraction(disconnected, "revise:toggle", objects);
    assert.deepEqual(activated, [connected.id]);
  } finally {
    setWorkflowPluginActionHandler(null);
  }
});

test("timer starts, pauses, resumes, and pauses another running timer atomically", () => {
  const first = timer("first");
  const second = timer("second");
  const start = new WorkflowTerminatorNode({ ...common("timer-start"), role: "Start", name: "Start" });
  const objects: CanvasObject[] = [start, first, second, arrow("start-first", start.id, first.id), arrow("start-second", start.id, second.id)];
  applyWorkflowUpdates(objects, toggleTimerUpdates(objects, first.id, 1_000));
  assert.equal(first.timerStatus, "running");
  assert.equal(first.startedAt, 1_000);
  applyWorkflowUpdates(objects, toggleTimerUpdates(objects, first.id, 11_000));
  assert.equal(first.timerStatus, "paused");
  assert.equal(first.elapsedMs, 10_000);
  applyWorkflowUpdates(objects, toggleTimerUpdates(objects, first.id, 21_000));
  applyWorkflowUpdates(objects, toggleTimerUpdates(objects, second.id, 31_000));
  assert.equal(first.timerStatus, "paused");
  assert.equal(first.elapsedMs, 20_000);
  assert.equal(second.timerStatus, "running");
});

test("a completed disconnected timer cannot restart outside workflow progression", () => {
  const focus = timer("restart", { elapsedMs: 60_000, timerStatus: "completed" });
  assert.deepEqual(toggleTimerUpdates([focus], focus.id, 5_000), []);
  assert.equal(focus.elapsedMs, 60_000);
  assert.equal(focus.timerStatus, "completed");
});

test("timer expiration uses wall-clock time and advances to its next node", () => {
  const focus = timer("focus", {
    elapsedMs: 20_000,
    startedAt: 1_000,
    timerStatus: "running",
  });
  const next = task("next");
  const start = new WorkflowTerminatorNode({ ...common("expiry-start"), role: "Start", name: "Start" });
  const objects: CanvasObject[] = [
    start,
    focus,
    next,
    arrow("start-focus", start.id, focus.id),
    arrow("focus-next", focus.id, next.id),
  ];
  assert.equal(timerElapsed(focus, 41_000), 60_000);
  const updates = expiredTimerUpdates(objects, 41_000);
  applyWorkflowUpdates(objects, updates);
  assert.equal(focus.timerStatus, "completed");
  assert.equal(focus.elapsedMs, focus.durationMs);
  assert.deepEqual(workflowEntryNodes(objects).map((node) => node.id), [next.id]);
});

test("load normalization keeps only the newest nonexpired running timer", () => {
  const older = timer("older", { startedAt: 1_000, timerStatus: "running" });
  const newer = timer("newer", { startedAt: 2_000, timerStatus: "running" });
  const objects: CanvasObject[] = [older, newer];
  applyWorkflowUpdates(objects, normalizeTimerUpdates(objects, 12_000));
  assert.equal(older.timerStatus, "paused");
  assert.equal(older.elapsedMs, 11_000);
  assert.equal(newer.timerStatus, "running");
});

test("final subtask completion progresses, while uncompleting never rolls it back", () => {
  const source = new WorkflowTaskNode({
    ...common("subtasks"),
    name: "Subtasks",
    subtasks: [{ id: "only", name: "Only", completed: false }],
  });
  const next = task("after-subtasks");
  const start = new WorkflowTerminatorNode({ ...common("subtask-start"), role: "Start", name: "Start" });
  const objects: CanvasObject[] = [start, source, next, arrow("start-subtask", start.id, source.id), arrow("subtask-next", source.id, next.id)];
  assert.equal(workflowNodeExtension.onPointerInteraction?.(source, "subtask:only", objects), true);
  assert.equal(source.completed, true);
  assert.deepEqual(workflowEntryNodes(objects).map((node) => node.id), [next.id]);

  const activation = new WorkflowNodeActivation(
    () => objects,
    (updates) => applyWorkflowUpdates(objects, updates),
  );
  source.subtasks = [];
  assert.equal(activation.activate(source), false);
  assert.equal(source.completed, true);
  assert.deepEqual(workflowEntryNodes(objects).map((node) => node.id), [next.id]);
});

test("scheduled Start resets re-arm reachable nodes and retain plugin history", () => {
  const now = Date.UTC(2026, 8, 8, 12);
  const start = new WorkflowTerminatorNode({
    ...common("scheduled-start"),
    role: "Start",
    name: "Start",
    resetSchedule: { kind: "interval", everyHours: 24, lastResetAt: now - 25 * 60 * 60 * 1_000 },
  });
  const first = task("reset-task", true);
  const plugin = new WorkflowPluginNode({
    ...common("reading-log"),
    pluginId: "workflows.book-nodes",
    pluginNodeType: "reading-log",
    pluginVersion: 1,
    pluginData: { sessions: [{ id: "kept" }] },
    completed: true,
  });
  const objects: CanvasObject[] = [
    start,
    first,
    plugin,
    arrow("start-task", start.id, first.id),
    arrow("task-plugin", first.id, plugin.id),
  ];
  setWorkflowPluginResetter((_pluginId, _nodeType, data) => ({ ...data, rearmed: true }));
  assert.equal(workflowResetIsDue(start.resetSchedule, now), true);
  assert.equal(workflowCanReset(objects, start.id), true);
  applyWorkflowUpdates(objects, dueWorkflowResetUpdates(objects, now));
  assert.equal(first.completed, false);
  assert.equal(plugin.completed, false);
  assert.deepEqual(plugin.pluginData.sessions, [{ id: "kept" }]);
  assert.equal(plugin.pluginData.rearmed, true);
  assert.equal(start.resetSchedule.lastResetAt, now);
  assert.equal(workflowCanReset(objects, start.id), false);
});

test("Start exposes the shared reset button only after connected state changes", () => {
  const start = new WorkflowTerminatorNode({
    ...common("manual-start"),
    role: "Start",
    name: "Start",
  });
  const changed = task("changed-task", true);
  const objects: CanvasObject[] = [
    start,
    changed,
    arrow("manual-edge", start.id, changed.id),
  ];
  setWorkflowObjectsProvider(() => objects);
  try {
    assert.deepEqual(
      workflowNodeExtension.pointerInteractionRegions?.(start).map((region) => region.id),
      ["terminator:reset"],
    );
    assert.equal(
      workflowNodeExtension.onPointerInteraction?.(start, "terminator:reset", objects),
      true,
    );
    assert.equal(changed.completed, false);
    assert.deepEqual(workflowNodeExtension.pointerInteractionRegions?.(start), []);
  } finally {
    setWorkflowObjectsProvider(null);
  }
});
