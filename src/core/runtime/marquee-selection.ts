import { arrowPathGeometry } from "../engine/arrows/arrow-path-geometry.ts";
import { boxGeometry } from "../engine/box-geometry.ts";
import { shapeGeometry } from "../engine/shapes/index.ts";
import type { ArrowObject } from "../model/arrow/arrow.ts";
import type { CanvasObject } from "../model/object.ts";
import type { PathObject } from "../model/shapes/path.ts";
import type { CanvasMarqueePreview } from "../types/runtime.ts";
import type { CanvasPoint } from "../types/geometry.ts";
import type { CanvasSelectionController } from "./selection.ts";

interface MarqueeSession {
  origin: CanvasPoint;
  current: CanvasPoint;
  initialIds: Set<string>;
  additive: boolean;
}

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export class CanvasMarqueeSelection {
  private session: MarqueeSession | null = null;

  get active(): boolean {
    return this.session !== null;
  }

  begin(point: CanvasPoint, selection: CanvasSelectionController, additive: boolean): void {
    this.session = {
      origin: { ...point },
      current: { ...point },
      initialIds: additive ? new Set(selection.objects) : new Set(),
      additive,
    };
    if (!additive) selection.clear();
  }

  update(
    point: CanvasPoint,
    objects: readonly CanvasObject[],
    selection: CanvasSelectionController,
  ): boolean {
    if (!this.session) return false;
    this.session.current = { ...point };
    const preview = this.preview();
    if (!preview) return false;
    const rect = this.rect(preview.origin, preview.current);
    const matching = objects.filter((object) =>
      preview.mode === "contain"
        ? this.isContained(object, objects, rect)
        : this.intersects(object, objects, rect),
    );
    selection.clear();
    for (const id of this.session.initialIds) selection.selectObject(id, true);
    for (const object of matching) selection.selectObject(object.id, true);
    return true;
  }

  preview(): CanvasMarqueePreview | null {
    if (!this.session) return null;
    return {
      origin: { ...this.session.origin },
      current: { ...this.session.current },
      mode: this.session.current.x >= this.session.origin.x ? "contain" : "cross",
    };
  }

  finish(): void {
    this.session = null;
  }

  cancel(selection: CanvasSelectionController): void {
    if (!this.session) return;
    selection.clear();
    for (const id of this.session.initialIds) selection.selectObject(id, true);
    this.session = null;
  }

  private isContained(object: CanvasObject, objects: readonly CanvasObject[], rect: Rect): boolean {
    return this.points(object, objects).every((point) => this.pointInRect(point, rect));
  }

  private intersects(object: CanvasObject, objects: readonly CanvasObject[], rect: Rect): boolean {
    const points = this.points(object, objects);
    if (points.some((point) => this.pointInRect(point, rect))) return true;
    const rectPoints = [
      { x: rect.left, y: rect.top },
      { x: rect.right, y: rect.top },
      { x: rect.right, y: rect.bottom },
      { x: rect.left, y: rect.bottom },
    ];
    if (object.type !== "arrow" && object.type !== "path") {
      if (rectPoints.some((point) => this.objectContains(object, point))) return true;
    }
    const closed = object.type !== "arrow" && object.type !== "path";
    const objectSegments = this.segments(points, closed);
    const rectSegments = this.segments(rectPoints, true);
    return objectSegments.some(([a, b]) =>
      rectSegments.some(([c, d]) => this.segmentsIntersect(a, b, c, d)),
    );
  }

  private points(object: CanvasObject, objects: readonly CanvasObject[]): CanvasPoint[] {
    if (object.type === "arrow") {
      return arrowPathGeometry.resolve(object as ArrowObject, objects).full;
    }
    if (object.type === "path") {
      return (object as PathObject).points;
    }
    if (shapeGeometry.isShape(object)) {
      return shapeGeometry.points(object).map((point) => shapeGeometry.localToWorld(object, point));
    }
    const center = boxGeometry.center(object);
    return [
      { x: object.x, y: object.y },
      { x: object.x + object.width, y: object.y },
      { x: object.x + object.width, y: object.y + object.height },
      { x: object.x, y: object.y + object.height },
    ].map((point) => boxGeometry.rotatePoint(point, center, object.rotation));
  }

  private objectContains(object: CanvasObject, point: CanvasPoint): boolean {
    return shapeGeometry.isShape(object)
      ? shapeGeometry.containsPoint(object, point)
      : boxGeometry.containsPoint(object, object.rotation, point);
  }

  private rect(a: CanvasPoint, b: CanvasPoint): Rect {
    return {
      left: Math.min(a.x, b.x),
      top: Math.min(a.y, b.y),
      right: Math.max(a.x, b.x),
      bottom: Math.max(a.y, b.y),
    };
  }

  private pointInRect(point: CanvasPoint, rect: Rect): boolean {
    return (
      point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
    );
  }

  private segments(
    points: readonly CanvasPoint[],
    closed: boolean,
  ): Array<[CanvasPoint, CanvasPoint]> {
    const segments = points
      .slice(1)
      .map((point, index) => [points[index], point] as [CanvasPoint, CanvasPoint]);
    if (closed && points.length > 2) segments.push([points[points.length - 1], points[0]]);
    return segments;
  }

  private segmentsIntersect(
    a: CanvasPoint,
    b: CanvasPoint,
    c: CanvasPoint,
    d: CanvasPoint,
  ): boolean {
    const cross = (p: CanvasPoint, q: CanvasPoint, r: CanvasPoint) =>
      (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    const abC = cross(a, b, c);
    const abD = cross(a, b, d);
    const cdA = cross(c, d, a);
    const cdB = cross(c, d, b);
    return abC * abD <= 0 && cdA * cdB <= 0;
  }
}
