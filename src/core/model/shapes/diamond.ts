import { BaseShapeObject, type BaseShapeObjectInit } from "./shape.ts";

export type DiamondObjectInit = BaseShapeObjectInit & { waistRatio?: number };

export class DiamondObject extends BaseShapeObject {
  readonly type = "diamond" as const;
  waistRatio: number;

  constructor(init: DiamondObjectInit) {
    super(init);
    this.waistRatio = Math.max(0.15, Math.min(0.85, init.waistRatio ?? 0.5));
  }
}
