import { Container, Rectangle } from "pixi.js";
import type { ResizeCorner } from "../types/events";
import type { Point } from "../types/geometry";
import type { CanvasElement } from "../types/elements";

export const detailSelectionColor = 0x4f7fe8;
export const minCardWidth = 24;
export const minCardHeight = 110;
export const fittedCardPadding = 6;
export const illustrationCardPadding = 12;

export function screenToWorld(viewport: Container, x: number, y: number) {
  return { x: (x - viewport.x) / viewport.scale.x, y: (y - viewport.y) / viewport.scale.y };
}

export function normalizeBounds(x1: number, y1: number, x2: number, y2: number) {
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
}

type Bounds = { x: number; y: number; width: number; height: number };

export function pointInBounds(point: Point, bounds: Bounds) {
  return point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height;
}

export function boundsContainBounds(outer: Bounds, inner: Bounds) {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
}

export function boundsTouchBounds(a: Bounds, b: Bounds) {
  return a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y;
}

export function pathBounds(element: Extract<CanvasElement, { type: "path" }>) {
  const xs = element.points.map((point) => point.x);
  const ys = element.points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return new Rectangle(x, y, Math.max(1, Math.max(...xs) - x), Math.max(1, Math.max(...ys) - y));
}

export function elementBounds(element: CanvasElement) {
  return element.type === "path" ? pathBounds(element) : new Rectangle(element.x, element.y, element.width, element.height);
}

export function fitElementBounds(element: CanvasElement) {
  if (element.type === "text" && !element.text.trim()) return null;
  if (element.type === "image" && !element.src && !element.previewSrc) return null;
  if (element.type === "path" && element.points.length < 2) return null;
  const bounds = elementBounds(element);
  const rotation = element.rotation ?? 0;
  if (!rotation || element.type === "path") return bounds;
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const corners = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ].map((point) => rotatePoint(point, center, rotation));
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return new Rectangle(x, y, Math.max(1, Math.max(...xs) - x), Math.max(1, Math.max(...ys) - y));
}

export function elementCenter(element: CanvasElement) {
  const bounds = elementBounds(element);
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

export function rotatePoint(point: Point, center: Point, rotation: number) {
  if (!rotation) return point;
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  const x = point.x - center.x;
  const y = point.y - center.y;
  return { x: center.x + x * cosine - y * sine, y: center.y + x * sine + y * cosine };
}

export function resizeHandleCenters(element: CanvasElement) {
  const bounds = elementBounds(element);
  const center = elementCenter(element);
  const rotation = element.rotation ?? 0;
  const corners = {
    topLeft: { x: bounds.x, y: bounds.y },
    topRight: { x: bounds.x + bounds.width, y: bounds.y },
    bottomRight: { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    bottomLeft: { x: bounds.x, y: bounds.y + bounds.height },
  };
  return Object.fromEntries(Object.entries(corners).map(([corner, point]) => [corner, rotatePoint(point, center, rotation)])) as Record<ResizeCorner, Point>;
}

export function distanceToSegment(
  point: Point,
  start: Point,
  end: Point,
): number {
  const dx =
    end.x - start.x;

  const dy =
    end.y - start.y;

  const lengthSquared =
    dx * dx +
    dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(
      point.x - start.x,
      point.y - start.y,
    );
  }

  const t =
    Math.max(
      0,
      Math.min(
        1,
        (
          (point.x - start.x) *
          dx +
          (point.y - start.y) *
          dy
        ) /
        lengthSquared,
      ),
    );

  const closestX =
    start.x +
    t * dx;

  const closestY =
    start.y +
    t * dy;

  return Math.hypot(
    point.x - closestX,
    point.y - closestY,
  );
}
