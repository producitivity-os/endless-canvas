import { BaseShapeObject, type BaseShapeObjectInit } from "./shape.ts";

export type ParallelogramObjectInit = BaseShapeObjectInit & { slantRatio?: number };

export class ParallelogramObject extends BaseShapeObject {
  readonly type = "parallelogram" as const;
  slantRatio: number;

  constructor(init: ParallelogramObjectInit) {
    super(init);
    this.slantRatio = Math.max(0, Math.min(0.45, init.slantRatio ?? 0.2));
  }
}
