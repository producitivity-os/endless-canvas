import type { CanvasObject } from "../model";
import { canvasPropertyRegistry, type CanvasPropertyRegistry } from "./property-registry.ts";
import type { CanvasPropertyName, CanvasPropertyPatch, CanvasPropertyValues } from "./types.ts";

export class CanvasPropertyMutation {
  private readonly registry: CanvasPropertyRegistry;

  constructor(registry: CanvasPropertyRegistry = canvasPropertyRegistry) {
    this.registry = registry;
  }

  apply(objects: readonly CanvasObject[], patch: CanvasPropertyPatch): number {
    let mutatedObjects = 0;
    for (const object of objects) {
      let mutated = false;
      for (const [rawName, rawValue] of Object.entries(patch)) {
        const name = rawName as CanvasPropertyName;
        if (!this.registry.supportsObject(name, object)) continue;
        const value = this.registry.validate(name, rawValue);
        if (value === undefined || Object.is(this.registry.value(object, name), value)) continue;
        this.assign(object, name, value);
        mutated = true;
      }
      if (mutated) mutatedObjects++;
    }
    return mutatedObjects;
  }

  private assign<K extends CanvasPropertyName>(
    object: CanvasObject,
    name: K,
    value: CanvasPropertyValues[K],
  ): void {
    (object as unknown as CanvasPropertyValues)[name] = value;
  }
}
