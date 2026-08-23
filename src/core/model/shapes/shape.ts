import { CanvasObject, type CanvasObjectInit } from "../object.ts";

export type BaseShapeObjectInit = CanvasObjectInit & {
  fill: number;
  stroke: number;
  strokeWidth?: number;
  fillStyle?: "solid" | "hachure" | "cross-hatch" | "none";
};

export abstract class BaseShapeObject extends CanvasObject {
  fill: number;
  stroke: number;
  strokeWidth?: number;
  fillStyle?: "solid" | "hachure" | "cross-hatch" | "none";

  protected constructor(init: BaseShapeObjectInit) {
    super(init);
    this.fill = init.fill;
    this.stroke = init.stroke;
    this.strokeWidth = init.strokeWidth;
    this.fillStyle = init.fillStyle;
  }
}
