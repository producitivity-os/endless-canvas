import type { CanvasPoint } from "../types";
import type { CanvasObject } from "./object";
import type { PathObject } from "./shapes";

function elementPosition(element: CanvasObject): CanvasPoint {
  if (element.type !== "path") return { x: element.x, y: element.y };
  const path = element as PathObject;
  return {
    x: Math.min(...path.points.map((point) => point.x)),
    y: Math.min(...path.points.map((point) => point.y)),
  };
}
export class ElementDragTarget implements Draggable {
  private readonly element: CanvasObject;
  constructor(element: CanvasObject) {
    this.element = element;
  }
  get id() {
    return this.element.id;
  }
  position() {
    return elementPosition(this.element);
  }
  moveTo(position: CanvasPoint) {
    const origin = elementPosition(this.element);
    const dx = position.x - origin.x;
    const dy = position.y - origin.y;
    if (this.element.type === "path")
      for (const point of (this.element as PathObject).points) {
        point.x += dx;
        point.y += dy;
      }
    else {
      this.element.x += dx;
      this.element.y += dy;
    }
  }
}

export interface Draggable {
  readonly id: string;
  position(): CanvasPoint;
  moveTo(position: CanvasPoint): void;
}
export class DragSession {
  private readonly origins = new Map<string, { target: Draggable; position: CanvasPoint }>();
  private readonly pointerOrigin: CanvasPoint;
  constructor(pointerOrigin: CanvasPoint, targets: Iterable<Draggable>) {
    this.pointerOrigin = pointerOrigin;
    for (const target of targets)
      this.origins.set(target.id, { target, position: target.position() });
  }
  move(pointer: CanvasPoint) {
    const dx = pointer.x - this.pointerOrigin.x;
    const dy = pointer.y - this.pointerOrigin.y;
    for (const { target, position } of this.origins.values())
      target.moveTo({ x: position.x + dx, y: position.y + dy });
  }
}
