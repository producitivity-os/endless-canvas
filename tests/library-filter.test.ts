import assert from "node:assert/strict";
import test from "node:test";
import type { CanvasRecord } from "../../../apps/Workflows/src/data/canvases.ts";
import {
  canvasLibraryFilterLabel,
  filterLibraryCanvases,
} from "../../../apps/Workflows/src/features/library/canvas-library-filter.ts";

const canvases: CanvasRecord[] = [
  {
    id: "base",
    title: "Base",
    editedAt: "Now",
    project: "Design",
    icon: "grid",
    canvasType: "base",
  },
  {
    id: "workflow",
    title: "Workflow",
    editedAt: "Now",
    project: "Product",
    icon: "network",
    canvasType: "workflow",
  },
  { id: "log", title: "Log", editedAt: "Now", project: "Research", icon: "pen", canvasType: "log" },
];

test("Workflows filters preserve Base and Log records while exposing only workflows", () => {
  assert.deepEqual(
    filterLibraryCanvases(canvases, "recents").map((canvas) => canvas.id),
    ["workflow"],
  );
  assert.deepEqual(
    filterLibraryCanvases(canvases, "type:base").map((canvas) => canvas.id),
    [],
  );
  assert.deepEqual(
    filterLibraryCanvases(canvases, "type:workflow").map((canvas) => canvas.id),
    ["workflow"],
  );
  assert.deepEqual(
    filterLibraryCanvases(canvases, "type:notebook").map((canvas) => canvas.id),
    [],
  );
  assert.deepEqual(filterLibraryCanvases(canvases, "type:log"), []);
  assert.equal(canvasLibraryFilterLabel("type:base"), "Workflows");
  assert.equal(canvasLibraryFilterLabel("type:workflow"), "Workflows");
  assert.equal(canvasLibraryFilterLabel("type:notebook"), "Workflows");
});
