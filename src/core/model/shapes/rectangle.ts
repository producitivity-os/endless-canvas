import { Shape, type ShapeInit } from "./shape";

export class RectangleElement extends Shape {
  readonly type = "rect" as const;
  cornerRadius?: number;
  constructor(init: ShapeInit & { cornerRadius?: number }) { super(init); this.cornerRadius = init.cornerRadius; }
}

