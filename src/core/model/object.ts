import type { CanvasPoint } from "../types";

export type CanvasObjectType =
  | "rect"
  | "card"
  | "ellipse"
  | "diamond"
  | "pentagon"
  | "parallelogram"
  | "image"
  | "path"
  | "arrow"
  | "text";

export interface CanvasObjectInit {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
}

export abstract class CanvasObject {
  abstract readonly type: CanvasObjectType;
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;

  protected constructor(init: CanvasObjectInit) {
    this.id = init.id;
    this.x = init.x;
    this.y = init.y;
    this.width = init.width;
    this.height = init.height;
    this.rotation = init.rotation ?? 0;
    this.opacity = init.opacity ?? 1;
  }

  moveTo(point: CanvasPoint) {
    this.x = point.x;
    this.y = point.y;
  }
  translate(dx: number, dy: number) {
    this.x += dx;
    this.y += dy;
  }
  bounds() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }
}
