import { BaseShapeObject, type BaseShapeObjectInit } from "./shape.ts";

export type PentagonObjectInit = BaseShapeObjectInit & {
  shoulderRatio?: number;
  apexRatio?: number;
};

export class PentagonObject extends BaseShapeObject {
  readonly type = "pentagon" as const;
  shoulderRatio: number;
  apexRatio: number;

  constructor(init: PentagonObjectInit) {
    super(init);
    this.shoulderRatio = Math.max(0.18, Math.min(0.68, init.shoulderRatio ?? 0.38));
    this.apexRatio = Math.max(0.2, Math.min(0.8, init.apexRatio ?? 0.5));
  }
}
