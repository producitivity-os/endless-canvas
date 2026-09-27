import type { CanvasObject } from "../model/object.ts";
import type {
  CanvasObjectExtension,
  CanvasSelectionGeometry,
  CanvasConnectionHandleMetadata,
  CanvasObjectMinimumSize,
  CanvasObjectPointerInteractionRegion,
  CanvasObjectPointerGesture,
} from "../types/extensions.ts";

export interface CanvasObjectPointerInteractionHit {
  object: CanvasObject;
  region: CanvasObjectPointerInteractionRegion;
}

export class CanvasObjectExtensionRegistry {
  private readonly extensions = new Map<string, CanvasObjectExtension>();

  constructor(extensions: readonly CanvasObjectExtension<any>[] = []) {
    for (const extension of extensions) this.extensions.set(extension.type, extension);
  }

  selectionGeometry(object: CanvasObject): CanvasSelectionGeometry | null {
    return this.extensions.get(object.type)?.selectionGeometry?.(object) ?? null;
  }

  hasPermanentConnectionHandles(object: CanvasObject): boolean {
    const value = this.extensions.get(object.type)?.permanentConnectionHandles;
    return typeof value === "function" ? value(object) : value === true;
  }

  connectionHandles(object: CanvasObject): readonly CanvasConnectionHandleMetadata[] | null {
    return this.extensions.get(object.type)?.connectionHandles?.(object) ?? null;
  }

  minimumSize(object: CanvasObject): CanvasObjectMinimumSize | null {
    return this.extensions.get(object.type)?.minimumSize?.(object) ?? null;
  }

  hitPointerInteractionRegion(
    objects: readonly CanvasObject[],
    point: { x: number; y: number },
  ): CanvasObjectPointerInteractionHit | null {
    for (let index = objects.length - 1; index >= 0; index--) {
      const object = objects[index];
      const regions = this.extensions.get(object.type)?.pointerInteractionRegions?.(object) ?? [];
      if (regions.length === 0) continue;
      const local = this.toLocalPoint(object, point);
      const region = regions.find(
        ({ bounds }) =>
          local.x >= bounds.x &&
          local.x <= bounds.x + bounds.width &&
          local.y >= bounds.y &&
          local.y <= bounds.y + bounds.height,
      );
      if (region) return { object, region };
    }
    return null;
  }

  activatePointerInteraction(
    object: CanvasObject,
    regionId: string,
    objects: readonly CanvasObject[] = [object],
  ): boolean {
    return (
      this.extensions.get(object.type)?.onPointerInteraction?.(object, regionId, objects) ?? false
    );
  }

  activatePointerGesture(
    object: CanvasObject,
    regionId: string,
    phase: CanvasObjectPointerGesture["phase"],
    point: { x: number; y: number },
    objects: readonly CanvasObject[] = [object],
  ): boolean {
    return this.extensions.get(object.type)?.onPointerGesture?.(
      object,
      regionId,
      { phase, localPoint: this.toLocalPoint(object, point) },
      objects,
    ) ?? false;
  }

  private toLocalPoint(
    object: CanvasObject,
    point: { x: number; y: number },
  ): { x: number; y: number } {
    const centerX = object.x + object.width / 2;
    const centerY = object.y + object.height / 2;
    const dx = point.x - centerX;
    const dy = point.y - centerY;
    const cosine = Math.cos(object.rotation);
    const sine = Math.sin(object.rotation);
    return {
      x: dx * cosine + dy * sine + object.width / 2,
      y: -dx * sine + dy * cosine + object.height / 2,
    };
  }
}
