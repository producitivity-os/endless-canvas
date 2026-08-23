import type { CanvasObject } from "../../model";
import type { CanvasPoint } from "../../types";
import { boxGeometry } from "../box-geometry.ts";
import { EllipseGeometry, RectangleGeometry } from "./box-shape-geometries.ts";
import {
  DiamondGeometry,
  ParallelogramGeometry,
  PentagonGeometry,
} from "./polygon-shape-geometries.ts";
import type {
  CanvasShapeObject,
  ShapeGeometry,
  ShapeParameterHandle,
  ShapeParameterName,
  ShapeResizeHandle,
} from "./geometry-types.ts";

export type {
  CanvasShapeObject,
  ShapeGeometry,
  ShapeParameterHandle,
  ShapeParameterName,
  ShapeResizeHandle,
} from "./geometry-types.ts";

export class ShapeGeometryRegistry {
  private readonly rectangle = new RectangleGeometry();
  private readonly ellipse = new EllipseGeometry();
  private readonly diamond = new DiamondGeometry();
  private readonly pentagon = new PentagonGeometry();
  private readonly parallelogram = new ParallelogramGeometry();

  isShape(object: CanvasObject): object is CanvasShapeObject {
    return ["rect", "ellipse", "diamond", "pentagon", "parallelogram"].includes(object.type);
  }

  geometryFor(shape: CanvasShapeObject): ShapeGeometry {
    switch (shape.type) {
      case "rect":
        return this.rectangle as ShapeGeometry;
      case "ellipse":
        return this.ellipse as ShapeGeometry;
      case "diamond":
        return this.diamond as ShapeGeometry;
      case "pentagon":
        return this.pentagon as ShapeGeometry;
      case "parallelogram":
        return this.parallelogram as ShapeGeometry;
    }
  }

  points(shape: CanvasShapeObject): CanvasPoint[] {
    return this.geometryFor(shape).points(shape);
  }

  resizeHandles(shape: CanvasShapeObject): ShapeResizeHandle[] {
    return this.geometryFor(shape).resizeHandles(shape);
  }

  parameterHandles(shape: CanvasShapeObject): ShapeParameterHandle[] {
    return this.geometryFor(shape).parameterHandles(shape);
  }

  setParameter(shape: CanvasShapeObject, parameter: ShapeParameterName, point: CanvasPoint): void {
    this.geometryFor(shape).setParameter(shape, parameter, point);
  }

  parameterValue(shape: CanvasShapeObject, parameter: ShapeParameterName): number {
    return this.geometryFor(shape).parameterValue(shape, parameter);
  }

  parameterDelta(
    shape: CanvasShapeObject,
    parameter: ShapeParameterName,
    previousPoint: CanvasPoint,
    point: CanvasPoint,
  ): number {
    return this.geometryFor(shape).parameterDelta(shape, parameter, previousPoint, point);
  }

  setParameterValue(shape: CanvasShapeObject, parameter: ShapeParameterName, value: number): void {
    this.geometryFor(shape).setParameterValue(shape, parameter, value);
  }

  localToWorld(shape: CanvasShapeObject, point: CanvasPoint): CanvasPoint {
    const center = boxGeometry.center(shape);
    return boxGeometry.rotatePoint(
      { x: shape.x + point.x, y: shape.y + point.y },
      center,
      shape.rotation,
    );
  }

  worldToLocal(shape: CanvasShapeObject, point: CanvasPoint): CanvasPoint {
    const center = boxGeometry.center(shape);
    const unrotated = boxGeometry.rotatePoint(point, center, -shape.rotation);
    return { x: unrotated.x - shape.x, y: unrotated.y - shape.y };
  }

  containsPoint(shape: CanvasShapeObject, point: CanvasPoint): boolean {
    const local = this.worldToLocal(shape, point);
    const polygon = this.points(shape);
    let inside = false;
    for (
      let current = 0, previous = polygon.length - 1;
      current < polygon.length;
      previous = current++
    ) {
      const a = polygon[current];
      const b = polygon[previous];
      const crosses =
        a.y > local.y !== b.y > local.y &&
        local.x < ((b.x - a.x) * (local.y - a.y)) / (b.y - a.y || 0.0001) + a.x;
      if (crosses) {
        inside = !inside;
      }
    }
    return inside;
  }
}

export const shapeGeometry = new ShapeGeometryRegistry();
