import type {
  DiamondObject,
  EllipseObject,
  ParallelogramObject,
  PentagonObject,
  RectangleObject,
} from "../../model";
import type { CanvasPoint, ResizeHandle } from "../../types";

export type CanvasShapeObject =
  RectangleObject | EllipseObject | DiamondObject | PentagonObject | ParallelogramObject;

export type ShapeParameterName =
  "cornerRadius" | "arcSweep" | "waistRatio" | "shoulderRatio" | "apexRatio" | "slantRatio";

export interface ShapeResizeHandle {
  handle: ResizeHandle;
  point: CanvasPoint;
}

export interface ShapeParameterHandle {
  parameter: ShapeParameterName;
  point: CanvasPoint;
}

export interface ShapeGeometry<T extends CanvasShapeObject = CanvasShapeObject> {
  points(shape: T): CanvasPoint[];
  resizeHandles(shape: T): ShapeResizeHandle[];
  parameterHandles(shape: T): ShapeParameterHandle[];
  parameterValue(shape: T, parameter: ShapeParameterName): number;
  parameterDelta(
    shape: T,
    parameter: ShapeParameterName,
    previousPoint: CanvasPoint,
    point: CanvasPoint,
  ): number;
  setParameterValue(shape: T, parameter: ShapeParameterName, value: number): void;
  setParameter(shape: T, parameter: ShapeParameterName, point: CanvasPoint): void;
}

export abstract class BaseShapeGeometry<T extends CanvasShapeObject> implements ShapeGeometry<T> {
  abstract points(shape: T): CanvasPoint[];
  abstract resizeHandles(shape: T): ShapeResizeHandle[];

  parameterHandles(_shape: T): ShapeParameterHandle[] {
    void _shape;
    return [];
  }

  parameterValue(_shape: T, _parameter: ShapeParameterName): number {
    void _shape;
    void _parameter;
    return 0;
  }

  parameterDelta(
    _shape: T,
    _parameter: ShapeParameterName,
    _previousPoint: CanvasPoint,
    _point: CanvasPoint,
  ): number {
    void _shape;
    void _parameter;
    void _previousPoint;
    void _point;
    return 0;
  }

  setParameterValue(_shape: T, _parameter: ShapeParameterName, _value: number): void {
    void _shape;
    void _parameter;
    void _value;
  }

  setParameter(_shape: T, _parameter: ShapeParameterName, _point: CanvasPoint): void {
    void _shape;
    void _parameter;
    void _point;
  }

  protected interpolate(start: CanvasPoint, end: CanvasPoint, amount: number): CanvasPoint {
    return {
      x: start.x + (end.x - start.x) * amount,
      y: start.y + (end.y - start.y) * amount,
    };
  }
}
