import type { BaseElement, CanvasElement } from "../types/elements";
import type { Point } from "../types/geometry";

export abstract class Element implements BaseElement {
  abstract readonly type: CanvasElement["type"] | "arrow";
  id: string; x: number; y: number; width: number; height: number; rotation?: number;

  protected constructor(init: BaseElement) {
    this.id = init.id; this.x = init.x; this.y = init.y; this.width = init.width; this.height = init.height; this.rotation = init.rotation;
  }

  moveTo(point: Point) { this.x = point.x; this.y = point.y; }
  translate(dx: number, dy: number) { this.x += dx; this.y += dy; }
  bounds() { return { x: this.x, y: this.y, width: this.width, height: this.height }; }
}
