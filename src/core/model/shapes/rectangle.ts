import { BaseShapeObject, type BaseShapeObjectInit } from "./shape.ts";

export type RectangleObjectInit = BaseShapeObjectInit & { cornerRadius?: number };

export class RectangleObject extends BaseShapeObject {
  readonly type = "rect" as const;
  cornerRadius?: number;
  constructor(init: RectangleObjectInit) {
    super(init);
    this.cornerRadius = init.cornerRadius;
  }
}

// export interface RectElement extends CanvasObject {
//   type: "rect";
//   fill: number;
//   stroke: number;
//   strokeWidth?: number;
//   fillStyle?: "solid" | "hachure" | "cross-hatch" | "none";
//   cornerRadius?: number;
// }
//
