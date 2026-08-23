import type { CanvasTool } from "../types";
import { canvasPropertyRegistry, type CanvasPropertyRegistry } from "./property-registry.ts";
import type {
  CanvasPropertyDefault,
  CanvasPropertyDefaultsByTool,
  CanvasPropertyPatch,
} from "./types.ts";

export class CanvasPropertyDefaults {
  private readonly values = new Map<CanvasTool, CanvasPropertyPatch>();
  private readonly registry: CanvasPropertyRegistry;

  constructor(
    initial: CanvasPropertyDefaultsByTool = {},
    registry: CanvasPropertyRegistry = canvasPropertyRegistry,
  ) {
    this.registry = registry;
    for (const tool of this.creationTools()) {
      const defaults: CanvasPropertyPatch = {};
      for (const definition of registry.all()) {
        if (registry.supportsTool(definition.name, tool) && definition.defaultValue !== undefined) {
          this.assign(defaults, definition.name, definition.defaultValue);
        }
      }
      this.values.set(tool, defaults);
    }
    this.values.set("markdown", { ...this.values.get("text"), format: "markdown" });
    this.values.set("line", { ...this.values.get("arrow"), endHead: "none" });
    for (const [rawTool, patch] of Object.entries(initial)) {
      if (patch) this.apply(rawTool as CanvasTool, patch);
    }
  }

  forTool(tool: CanvasTool): CanvasPropertyDefault {
    return this.values.get(tool) ?? {};
  }

  apply(tool: CanvasTool, patch: CanvasPropertyPatch): number {
    const current = this.values.get(tool);
    if (!current) return 0;
    let changes = 0;
    for (const [rawName, rawValue] of Object.entries(patch)) {
      const name = rawName as keyof CanvasPropertyPatch;
      if (!this.registry.supportsTool(name, tool)) continue;
      const value = this.registry.validate(name, rawValue);
      if (value === undefined || Object.is(current[name], value)) continue;
      this.assign(current, name, value);
      changes++;
    }
    return changes;
  }

  private creationTools(): CanvasTool[] {
    return [
      "text",
      "markdown",
      "card",
      "image",
      "arrow",
      "line",
      "pencil",
      "rect",
      "ellipse",
      "diamond",
      "pentagon",
      "parallelogram",
    ];
  }

  private assign<K extends keyof CanvasPropertyPatch>(
    target: CanvasPropertyPatch,
    name: K,
    value: NonNullable<CanvasPropertyPatch[K]>,
  ): void {
    target[name] = value;
  }
}
