import { shapeGeometry } from "../engine/shapes/shape-geometry.ts";
import type { ShapeParameterName } from "../engine/shapes/geometry-types.ts";
import type { CanvasObject } from "../model";
import type { CanvasPoint } from "../types";

export interface ShapeParameterDragEvent {
  type: "adjust-shape-parameter";
  objectId: string;
  parameter: ShapeParameterName;
  originalValue: number;
  pointerStartLocal: CanvasPoint;
}

export class ShapeParameterDragSession {
  create(
    object: CanvasObject,
    parameter: ShapeParameterName,
    pointer: CanvasPoint,
  ): ShapeParameterDragEvent | null {
    if (!shapeGeometry.isShape(object)) {
      return null;
    }
    return {
      type: "adjust-shape-parameter",
      objectId: object.id,
      parameter,
      originalValue: shapeGeometry.parameterValue(object, parameter),
      pointerStartLocal: shapeGeometry.worldToLocal(object, pointer),
    };
  }

  update(object: CanvasObject, drag: ShapeParameterDragEvent, pointer: CanvasPoint): boolean {
    if (!shapeGeometry.isShape(object)) {
      return false;
    }
    const point = shapeGeometry.worldToLocal(object, pointer);
    const totalDelta = shapeGeometry.parameterDelta(
      object,
      drag.parameter,
      drag.pointerStartLocal,
      point,
    );
    const before = shapeGeometry.parameterValue(object, drag.parameter);
    shapeGeometry.setParameterValue(object, drag.parameter, drag.originalValue + totalDelta);
    return before !== shapeGeometry.parameterValue(object, drag.parameter);
  }
}
