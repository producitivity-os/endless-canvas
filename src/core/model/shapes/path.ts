import { BaseShapeObject, type BaseShapeObjectInit } from "./shape.ts";
import type { CanvasPoint } from "../../types";

export type PathObjectInit = BaseShapeObjectInit & { points: CanvasPoint[]; color: number };

export class PathObject extends BaseShapeObject {
  readonly type = "path" as const;
  id: string;
  points: CanvasPoint[];
  color: number;

  constructor(init: PathObjectInit) {
    super(init);
    this.id = init.id;
    this.points = init.points;
    this.color = init.color;
  }
  translate(dx: number, dy: number) {
    super.translate(dx, dy);
    for (const point of this.points) {
      point.x += dx;
      point.y += dy;
    }
  }
}

// export interface PathElement {
//   id: string;
//   type: "path";
//   points: CanvasPoint[];
//   color: number;
//   width: number;
//   rotation?: number;
// }
