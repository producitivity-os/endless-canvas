import type { CanvasObject } from "../model";
import type { CanvasTool } from "../types";
import type { CanvasPropertyDefaults } from "./property-defaults.ts";
import { canvasPropertyRegistry, type CanvasPropertyRegistry } from "./property-registry.ts";
import {
  CANVAS_MIXED_VALUE,
  type CanvasPropertyContext,
  type CanvasPropertyField,
  type CanvasPropertyName,
  type CanvasPropertyValues,
} from "./types.ts";

export class CanvasPropertyContextBuilder {
  private readonly registry: CanvasPropertyRegistry;

  constructor(registry: CanvasPropertyRegistry = canvasPropertyRegistry) {
    this.registry = registry;
  }

  build(
    tool: CanvasTool,
    objects: readonly CanvasObject[],
    selectedIds: ReadonlySet<string>,
    defaults: CanvasPropertyDefaults,
  ): CanvasPropertyContext {
    const selected = objects.filter((object) => selectedIds.has(object.id));
    if (selected.length > 0) {
      return {
        mode: "selection",
        tool,
        selectionCount: selected.length,
        fields: this.selectionFields(selected),
      };
    }
    const fields = this.defaultFields(tool, defaults);
    return {
      mode: fields.length > 0 ? "defaults" : "none",
      tool,
      selectionCount: 0,
      fields,
    };
  }

  signature(context: CanvasPropertyContext): string {
    return JSON.stringify(context);
  }

  private selectionFields(objects: readonly CanvasObject[]): CanvasPropertyField[] {
    const fields: CanvasPropertyField[] = [];
    for (const definition of this.registry.all()) {
      if (!objects.every((object) => this.registry.supportsObject(definition.name, object))) {
        continue;
      }
      const values = objects.map((object) => this.registry.value(object, definition.name));
      const first = values[0];
      const value = values.every((candidate) => Object.is(candidate, first))
        ? (first as CanvasPropertyValues[CanvasPropertyName])
        : CANVAS_MIXED_VALUE;
      if (first === undefined) continue;
      fields.push({ ...definition, value });
    }
    return fields;
  }

  private defaultFields(tool: CanvasTool, defaults: CanvasPropertyDefaults): CanvasPropertyField[] {
    const values = defaults.forTool(tool);
    return this.registry
      .all()
      .filter((definition) => this.registry.supportsTool(definition.name, tool))
      .flatMap((definition) => {
        const value = values[definition.name];
        return value === undefined ? [] : [{ ...definition, value }];
      });
  }
}
