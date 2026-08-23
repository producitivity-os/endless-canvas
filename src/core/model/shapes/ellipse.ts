import { BaseShapeObject, type BaseShapeObjectInit } from "./shape.ts";

export type EllipseObjectInit = BaseShapeObjectInit & { arcSweep?: number };

export class EllipseObject extends BaseShapeObject {
  readonly type = "ellipse" as const;
  arcSweep: number;
  constructor(init: EllipseObjectInit) {
    super(init);
    this.arcSweep = Math.max(0.01, Math.min(1, init.arcSweep ?? 1));
  }
}

// export interface EllipseElement extends CanvasObject {
//   type: "ellipse";
//   fill: number;
//   stroke: number;
//   strokeWidth?: number;
//   fillStyle?: "solid" | "hachure" | "cross-hatch" | "none";
// }
//
