import { boxGeometry } from "../engine/box-geometry.ts";
import { arrowPathGeometry } from "../engine/arrows/arrow-path-geometry.ts";
import type { ShapeParameterName } from "../engine/shapes/geometry-types.ts";
import { shapeGeometry } from "../engine/shapes/shape-geometry.ts";
import {
  selectionHandles,
  type ResizeHandleDescriptor,
} from "../engine/renderers/selection-handles.ts";
import { distanceToSegment, minCardWidth } from "../engine/utils.ts";
import type { ArrowObject, CanvasObject, PathObject, RectangleObject, TextObject } from "../model/index.ts";
import type { CanvasPoint, ResizeHandle } from "../types/index.ts";
import type { CanvasObjectMinimumSize } from "../types/extensions.ts";
import type { CanvasDragEvent } from "./canvas-drag.ts";
import { ShapeParameterDragSession } from "./shape-parameter-drag.ts";

type ResizeObjectDrag = Extract<CanvasDragEvent, { type: "resize-object" }>;
type RotateObjectDrag = Extract<CanvasDragEvent, { type: "rotate-object" }>;
type ParameterDrag = Extract<CanvasDragEvent, { type: "adjust-shape-parameter" }>;

export type SelectionHandleHit =
  | { type: "resize"; object: CanvasObject; descriptor: ResizeHandleDescriptor }
  | { type: "parameter"; object: CanvasObject; parameter: ShapeParameterName }
  | { type: "rotation"; object: CanvasObject };

export class CanvasObjectInteraction {
  private readonly parameterDrag = new ShapeParameterDragSession();
  hitObject(objects: CanvasObject[], point: CanvasPoint): CanvasObject | null {
    for (let index = objects.length - 1; index >= 0; index--) {
      const object = objects[index];

      if (this.containsPoint(object, objects, point)) {
        return object;
      }
    }

    return null;
  }

  private containsPoint(
    object: CanvasObject,
    objects: readonly CanvasObject[],
    point: CanvasPoint,
  ): boolean {
    if (object.type === "path") {
      const path = object as PathObject;
      return path.points
        .slice(1)
        .some((next, index) => distanceToSegment(point, path.points[index], next) <= 6);
    }

    if (object.type === "arrow") {
      const arrow = object as ArrowObject;
      return arrowPathGeometry.hitTest(arrow, objects, point, 7);
    }

    if (shapeGeometry.isShape(object)) {
      return shapeGeometry.containsPoint(object, point);
    }

    return boxGeometry.containsPoint(object, object.rotation, point);
  }

  hitSelectionHandle(
    objects: CanvasObject[],
    selectedIds: ReadonlySet<string>,
    point: CanvasPoint,
    scale: number,
  ): SelectionHandleHit | null {
    if (selectedIds.size !== 1) return null;
    for (let index = objects.length - 1; index >= 0; index--) {
      const object = objects[index];
      if (!selectedIds.has(object.id)) {
        continue;
      }

      const hit = selectionHandles.hitTest(object, point, scale);
      if (hit?.type === "resize") {
        return { type: "resize", object, descriptor: hit.descriptor };
      }
      if (hit?.type === "rotation") {
        return { type: "rotation", object };
      }
      if (hit?.type === "parameter") {
        return { type: "parameter", object, parameter: hit.descriptor.parameter };
      }
    }

    return null;
  }

  createResizeDrag(
    object: CanvasObject,
    handle: ResizeHandle,
    point: CanvasPoint,
  ): ResizeObjectDrag {
    return {
      type: "resize-object",
      objectId: object.id,
      originalBounds: object.bounds(),
      originalRotation: object.rotation,
      handle,
      pointerOrigin: { ...point },
    };
  }

  createRotationDrag(object: CanvasObject, point: CanvasPoint): RotateObjectDrag | null {
    if (!object.capabilities.rotatable) return null;
    const originalBounds = object.bounds();
    const center = boxGeometry.center(originalBounds);

    return {
      type: "rotate-object",
      objectId: object.id,
      originalBounds,
      originalRotation: object.rotation,
      pointerOrigin: { ...point },
      previousPointerAngle: Math.atan2(point.y - center.y, point.x - center.x),
      accumulatedRotation: 0,
    };
  }

  createParameterDrag(
    object: CanvasObject,
    parameter: ShapeParameterName,
    point: CanvasPoint,
  ): ParameterDrag | null {
    return this.parameterDrag.create(object, parameter, point);
  }

  adjustShapeParameter(object: CanvasObject, drag: ParameterDrag, point: CanvasPoint): boolean {
    return this.parameterDrag.update(object, drag, point);
  }

  resize(
    object: CanvasObject,
    drag: ResizeObjectDrag,
    point: CanvasPoint,
    shiftKey: boolean,
    extensionMinimum: CanvasObjectMinimumSize | null = null,
  ): void {
    const preserveAspectRatio = shiftKey;
    const minimumWidth = Math.max(object.type === "card" ? minCardWidth : 8, extensionMinimum?.width ?? 0);
    const minimumHeight = Math.max(8, extensionMinimum?.height ?? 0);
    const bounds = boxGeometry.resize(
      drag.handle,
      drag.originalBounds,
      drag.originalRotation,
      drag.pointerOrigin,
      point,
      minimumWidth,
      minimumHeight,
      preserveAspectRatio,
    );

    object.x = bounds.x;
    object.y = bounds.y;
    object.width = bounds.width;
    object.height = bounds.height;
    if (object.type === "text") {
      const text = object as TextObject;
      text.sizing = "fixed";
      text.minHeight = bounds.height;
    }
    if (object.type === "rect") {
      const rectangle = object as RectangleObject;
      rectangle.cornerRadius = Math.min(
        rectangle.cornerRadius ?? 0,
        rectangle.width / 2,
        rectangle.height / 2,
      );
    }
  }

  rotate(
    object: CanvasObject,
    drag: RotateObjectDrag,
    point: CanvasPoint,
    shiftKey: boolean,
  ): void {
    if (!object.capabilities.rotatable) return;
    const center = boxGeometry.center(drag.originalBounds);
    const pointerAngle = Math.atan2(point.y - center.y, point.x - center.x);
    let angleDelta = pointerAngle - drag.previousPointerAngle;

    if (angleDelta > Math.PI) {
      angleDelta -= Math.PI * 2;
    } else if (angleDelta < -Math.PI) {
      angleDelta += Math.PI * 2;
    }

    drag.accumulatedRotation += angleDelta;
    drag.previousPointerAngle = pointerAngle;

    const rotation = drag.originalRotation + drag.accumulatedRotation;
    const snapIncrement = Math.PI / 12;
    object.rotation = shiftKey ? Math.round(rotation / snapIncrement) * snapIncrement : rotation;
  }
}
