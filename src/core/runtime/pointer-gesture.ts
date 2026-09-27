import type { CanvasPoint } from "../types/geometry.ts";

export const CANVAS_OBJECT_CLICK_DRAG_THRESHOLD = 4;

export function canvasObjectPointerIsClick(origin: CanvasPoint, current: CanvasPoint): boolean {
  return (
    Math.hypot(current.x - origin.x, current.y - origin.y) <= CANVAS_OBJECT_CLICK_DRAG_THRESHOLD
  );
}
