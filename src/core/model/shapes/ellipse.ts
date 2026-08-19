import { Shape, type ShapeInit } from "../shape";

export class EllipseElement extends Shape {
  readonly type = "ellipse" as const;
  constructor(init: ShapeInit) { super(init); }
}
