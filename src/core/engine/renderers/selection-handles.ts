import type { CanvasObject } from "../../model";
import type { ShapeParameterName } from "../shapes/geometry-types.ts";
import { shapeGeometry } from "../shapes/shape-geometry.ts";
import type { CanvasPoint, ResizeHandle } from "../../types";
import { boxGeometry } from "../box-geometry.ts";

export interface ResizeHandleDescriptor {
  handle: ResizeHandle;
  x: -1 | 0 | 1;
  y: -1 | 0 | 1;
  appearance: "circle" | "square";
  size: number;
  hitSize: number;
  localPoint?: CanvasPoint;
}

export interface ParameterHandleDescriptor {
  parameter: ShapeParameterName;
  localPoint: CanvasPoint;
  size: number;
  hitSize: number;
}

export type ObjectHandleHit =
  | { type: "resize"; descriptor: ResizeHandleDescriptor }
  | { type: "parameter"; descriptor: ParameterHandleDescriptor }
  | { type: "rotation" };

const CARD_RESIZE_HANDLES: readonly ResizeHandleDescriptor[] = [
  { handle: "left", x: -1, y: 0, appearance: "circle", size: 12, hitSize: 20 },
  { handle: "right", x: 1, y: 0, appearance: "circle", size: 12, hitSize: 20 },
];

const CORNER_RESIZE_HANDLES: readonly ResizeHandleDescriptor[] = [
  { handle: "topLeft", x: -1, y: -1, appearance: "square", size: 10, hitSize: 18 },
  { handle: "topRight", x: 1, y: -1, appearance: "square", size: 10, hitSize: 18 },
  { handle: "bottomRight", x: 1, y: 1, appearance: "square", size: 10, hitSize: 18 },
  { handle: "bottomLeft", x: -1, y: 1, appearance: "square", size: 10, hitSize: 18 },
];

const HANDLE_DIRECTIONS: Record<ResizeHandle, { x: -1 | 0 | 1; y: -1 | 0 | 1 }> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
  topLeft: { x: -1, y: -1 },
  topRight: { x: 1, y: -1 },
  bottomRight: { x: 1, y: 1 },
  bottomLeft: { x: -1, y: 1 },
};

export class SelectionHandles {
  descriptors(object: CanvasObject): readonly ResizeHandleDescriptor[] {
    if (shapeGeometry.isShape(object)) {
      return shapeGeometry.resizeHandles(object).map(({ handle, point }) => ({
        handle,
        ...HANDLE_DIRECTIONS[handle],
        appearance: "circle" as const,
        size: 10,
        hitSize: 18,
        localPoint: point,
      }));
    }

    switch (object.type) {
      case "card":
        return CARD_RESIZE_HANDLES;
      case "image":
      case "text":
        return CORNER_RESIZE_HANDLES;
      default:
        return [];
    }
  }

  parameterDescriptors(object: CanvasObject): readonly ParameterHandleDescriptor[] {
    if (!shapeGeometry.isShape(object)) {
      return [];
    }
    return shapeGeometry.parameterHandles(object).map(({ parameter, point }) => ({
      parameter,
      localPoint: point,
      size: 10,
      hitSize: 28,
    }));
  }

  resizePoint(object: CanvasObject, descriptor: ResizeHandleDescriptor): CanvasPoint {
    if (descriptor.localPoint && shapeGeometry.isShape(object)) {
      return shapeGeometry.localToWorld(object, descriptor.localPoint);
    }
    const center = boxGeometry.center(object);
    return boxGeometry.rotatePoint(
      {
        x: center.x + (descriptor.x * object.width) / 2,
        y: center.y + (descriptor.y * object.height) / 2,
      },
      center,
      object.rotation,
    );
  }

  parameterPoint(object: CanvasObject, descriptor: ParameterHandleDescriptor): CanvasPoint {
    return shapeGeometry.isShape(object)
      ? shapeGeometry.localToWorld(object, descriptor.localPoint)
      : boxGeometry.center(object);
  }

  rotationPoint(object: CanvasObject, scale: number): CanvasPoint | null {
    if (this.descriptors(object).length === 0) {
      return null;
    }
    const center = boxGeometry.center(object);
    const chromeScale = 1 / Math.max(scale, 0.001);
    return boxGeometry.rotatePoint(
      { x: center.x, y: object.y - 24 * chromeScale },
      center,
      object.rotation,
    );
  }

  cursor(handle: ResizeHandle, rotation: number): string {
    const direction = HANDLE_DIRECTIONS[handle];
    const angle = Math.atan2(direction.y, direction.x || 0.0001) + rotation;
    const index = ((Math.round(angle / (Math.PI / 4)) % 4) + 4) % 4;
    return ["ew-resize", "nwse-resize", "ns-resize", "nesw-resize"][index];
  }

  hitTest(object: CanvasObject, point: CanvasPoint, scale: number): ObjectHandleHit | null {
    const chromeScale = 1 / Math.max(scale, 0.001);
    for (const descriptor of this.parameterDescriptors(object)) {
      const handlePoint = this.parameterPoint(object, descriptor);
      if (
        Math.hypot(point.x - handlePoint.x, point.y - handlePoint.y) <=
        (descriptor.hitSize * chromeScale) / 2
      ) {
        return { type: "parameter", descriptor };
      }
    }
    for (const descriptor of this.descriptors(object)) {
      const handlePoint = this.resizePoint(object, descriptor);
      if (
        Math.hypot(point.x - handlePoint.x, point.y - handlePoint.y) <=
        (descriptor.hitSize * chromeScale) / 2
      ) {
        return { type: "resize", descriptor };
      }
    }
    const rotationPoint = this.rotationPoint(object, scale);
    if (
      rotationPoint &&
      Math.hypot(point.x - rotationPoint.x, point.y - rotationPoint.y) <= 10 * chromeScale
    ) {
      return { type: "rotation" };
    }
    return null;
  }
}

export const selectionHandles = new SelectionHandles();
