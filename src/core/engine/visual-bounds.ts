import type { ArrowObject } from "../model/arrow/arrow.ts";
import type { CanvasObject } from "../model/object.ts";
import type { PathObject } from "../model/shapes/path.ts";
import type { CanvasPoint } from "../types/geometry.ts";
import { arrowHeadGeometry } from "./arrows/arrow-head-geometry.ts";
import { arrowPathGeometry } from "./arrows/arrow-path-geometry.ts";
import { boxGeometry } from "./box-geometry.ts";
import { shapeGeometry } from "./shapes/shape-geometry.ts";

export interface CanvasVisualBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class CanvasVisualBoundsCalculator {
  forObjects(objects: readonly CanvasObject[]): CanvasVisualBounds | null {
    const bounds = objects
      .map((object) => this.forObject(object, objects))
      .filter((value): value is CanvasVisualBounds => value !== null);
    if (bounds.length === 0) return null;
    const minX = Math.min(...bounds.map((value) => value.x));
    const minY = Math.min(...bounds.map((value) => value.y));
    const maxX = Math.max(...bounds.map((value) => value.x + value.width));
    const maxY = Math.max(...bounds.map((value) => value.y + value.height));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  forObject(object: CanvasObject, objects: readonly CanvasObject[]): CanvasVisualBounds | null {
    if (object.type === "arrow") {
      return this.forArrow(object as ArrowObject, objects);
    }
    if (object.type === "path") {
      return this.forPath(object as PathObject);
    }
    if (shapeGeometry.isShape(object)) {
      const points = shapeGeometry
        .points(object)
        .map((point) => shapeGeometry.localToWorld(object, point));
      return this.fromPoints(points, (object.strokeWidth ?? 0) / 2);
    }
    const center = boxGeometry.center(object);
    const points = [
      { x: object.x, y: object.y },
      { x: object.x + object.width, y: object.y },
      { x: object.x + object.width, y: object.y + object.height },
      { x: object.x, y: object.y + object.height },
    ].map((point) => boxGeometry.rotatePoint(point, center, object.rotation));
    return this.fromPoints(points, object.type === "card" ? 0.5 : 0);
  }

  private forPath(path: PathObject): CanvasVisualBounds | null {
    return this.fromPoints(path.points, (path.strokeWidth ?? 2.5) / 2);
  }

  private forArrow(
    arrow: ArrowObject,
    objects: readonly CanvasObject[],
  ): CanvasVisualBounds | null {
    const path = arrowPathGeometry.resolve(arrow, objects);
    if (path.visible.length < 2) return null;
    const bounds: CanvasVisualBounds[] = [];
    const shaft = arrowHeadGeometry.trimPath(
      path.visible,
      arrowHeadGeometry.trimDistance(arrow.startHead),
      arrowHeadGeometry.trimDistance(arrow.endHead),
    );
    const shaftBounds = this.fromPoints(shaft, arrow.strokeWidth / 2);
    if (shaftBounds) bounds.push(shaftBounds);
    const startFrom = path.visible[1];
    const endFrom = path.visible[path.visible.length - 2];
    if (arrow.startHead !== "none" && startFrom) {
      const head = arrowHeadGeometry.resolve(path.visible[0], startFrom);
      const headBounds = this.fromPoints(
        [head.tip, head.left, head.right],
        arrow.startHead === "triangle" ? 0 : 0.75,
      );
      if (headBounds) bounds.push(headBounds);
    }
    if (arrow.endHead !== "none" && endFrom) {
      const head = arrowHeadGeometry.resolve(path.visible[path.visible.length - 1], endFrom);
      const headBounds = this.fromPoints(
        [head.tip, head.left, head.right],
        arrow.endHead === "triangle" ? 0 : 0.75,
      );
      if (headBounds) bounds.push(headBounds);
    }
    return this.union(bounds);
  }

  private union(bounds: readonly CanvasVisualBounds[]): CanvasVisualBounds | null {
    if (bounds.length === 0) return null;
    const minX = Math.min(...bounds.map((value) => value.x));
    const minY = Math.min(...bounds.map((value) => value.y));
    const maxX = Math.max(...bounds.map((value) => value.x + value.width));
    const maxY = Math.max(...bounds.map((value) => value.y + value.height));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  private fromPoints(points: readonly CanvasPoint[], padding: number): CanvasVisualBounds | null {
    if (points.length === 0) return null;
    const minX = Math.min(...points.map((point) => point.x)) - padding;
    const minY = Math.min(...points.map((point) => point.y)) - padding;
    const maxX = Math.max(...points.map((point) => point.x)) + padding;
    const maxY = Math.max(...points.map((point) => point.y)) + padding;
    return {
      x: minX,
      y: minY,
      width: Math.max(0, maxX - minX),
      height: Math.max(0, maxY - minY),
    };
  }
}

export const canvasVisualBounds = new CanvasVisualBoundsCalculator();
