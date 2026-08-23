import type { DiamondObject, ParallelogramObject, PentagonObject } from "../../model";
import type { CanvasPoint } from "../../types";
import {
  BaseShapeGeometry,
  type ShapeParameterHandle,
  type ShapeParameterName,
  type ShapeResizeHandle,
} from "./geometry-types.ts";

export class DiamondGeometry extends BaseShapeGeometry<DiamondObject> {
  points(shape: DiamondObject): CanvasPoint[] {
    return [
      { x: shape.width / 2, y: 0 },
      { x: shape.width, y: shape.height * shape.waistRatio },
      { x: shape.width / 2, y: shape.height },
      { x: 0, y: shape.height * shape.waistRatio },
    ];
  }

  resizeHandles(shape: DiamondObject): ShapeResizeHandle[] {
    const [top, right, bottom, left] = this.points(shape);
    return [
      { handle: "top", point: top },
      { handle: "right", point: right },
      { handle: "bottom", point: bottom },
      { handle: "left", point: left },
    ];
  }

  override parameterHandles(shape: DiamondObject): ShapeParameterHandle[] {
    const [top, right] = this.points(shape);
    return [{ parameter: "waistRatio", point: this.interpolate(top, right, 0.7) }];
  }

  override setParameter(
    shape: DiamondObject,
    parameter: ShapeParameterName,
    point: CanvasPoint,
  ): void {
    if (parameter === "waistRatio") {
      shape.waistRatio = Math.max(
        0.15,
        Math.min(0.85, point.y / Math.max(shape.height * 0.7, 0.001)),
      );
    }
  }

  override parameterValue(shape: DiamondObject, parameter: ShapeParameterName): number {
    return parameter === "waistRatio" ? shape.waistRatio : 0;
  }

  override parameterDelta(
    shape: DiamondObject,
    parameter: ShapeParameterName,
    previousPoint: CanvasPoint,
    point: CanvasPoint,
  ): number {
    return parameter === "waistRatio"
      ? (point.y - previousPoint.y) / Math.max(shape.height * 0.7, 0.001)
      : 0;
  }

  override setParameterValue(
    shape: DiamondObject,
    parameter: ShapeParameterName,
    value: number,
  ): void {
    if (parameter === "waistRatio") {
      shape.waistRatio = Math.max(0.15, Math.min(0.85, value));
    }
  }
}

export class PentagonGeometry extends BaseShapeGeometry<PentagonObject> {
  points(shape: PentagonObject): CanvasPoint[] {
    return [
      { x: shape.width * shape.apexRatio, y: 0 },
      { x: shape.width, y: shape.height * shape.shoulderRatio },
      { x: shape.width * 0.82, y: shape.height },
      { x: shape.width * 0.18, y: shape.height },
      { x: 0, y: shape.height * shape.shoulderRatio },
    ];
  }

  resizeHandles(shape: PentagonObject): ShapeResizeHandle[] {
    const points = this.points(shape);
    return [
      { handle: "top", point: points[0] },
      { handle: "right", point: points[1] },
      { handle: "bottom", point: { x: shape.width / 2, y: shape.height } },
      { handle: "left", point: points[4] },
    ];
  }

  override parameterHandles(shape: PentagonObject): ShapeParameterHandle[] {
    const [apex, rightShoulder, bottomRight] = this.points(shape);
    return [
      { parameter: "apexRatio", point: this.interpolate(apex, rightShoulder, 0.35) },
      { parameter: "shoulderRatio", point: this.interpolate(rightShoulder, bottomRight, 0.3) },
    ];
  }

  override setParameter(
    shape: PentagonObject,
    parameter: ShapeParameterName,
    point: CanvasPoint,
  ): void {
    if (parameter === "apexRatio") {
      const ratio = (point.x / Math.max(shape.width, 0.001) - 0.35) / 0.65;
      shape.apexRatio = Math.max(0.2, Math.min(0.8, ratio));
    } else if (parameter === "shoulderRatio") {
      const ratio = (point.y / Math.max(shape.height, 0.001) - 0.3) / 0.7;
      shape.shoulderRatio = Math.max(0.18, Math.min(0.68, ratio));
    }
  }

  override parameterValue(shape: PentagonObject, parameter: ShapeParameterName): number {
    if (parameter === "apexRatio") return shape.apexRatio;
    if (parameter === "shoulderRatio") return shape.shoulderRatio;
    return 0;
  }

  override parameterDelta(
    shape: PentagonObject,
    parameter: ShapeParameterName,
    previousPoint: CanvasPoint,
    point: CanvasPoint,
  ): number {
    if (parameter === "apexRatio") {
      return (point.x - previousPoint.x) / Math.max(shape.width * 0.65, 0.001);
    }
    if (parameter === "shoulderRatio") {
      return (point.y - previousPoint.y) / Math.max(shape.height * 0.7, 0.001);
    }
    return 0;
  }

  override setParameterValue(
    shape: PentagonObject,
    parameter: ShapeParameterName,
    value: number,
  ): void {
    if (parameter === "apexRatio") {
      shape.apexRatio = Math.max(0.2, Math.min(0.8, value));
    } else if (parameter === "shoulderRatio") {
      shape.shoulderRatio = Math.max(0.18, Math.min(0.68, value));
    }
  }
}

export class ParallelogramGeometry extends BaseShapeGeometry<ParallelogramObject> {
  points(shape: ParallelogramObject): CanvasPoint[] {
    const slant = shape.width * shape.slantRatio;
    return [
      { x: slant, y: 0 },
      { x: shape.width, y: 0 },
      { x: shape.width - slant, y: shape.height },
      { x: 0, y: shape.height },
    ];
  }

  resizeHandles(shape: ParallelogramObject): ShapeResizeHandle[] {
    const [topLeft, topRight, bottomRight, bottomLeft] = this.points(shape);
    return [
      { handle: "topLeft", point: topLeft },
      { handle: "topRight", point: topRight },
      { handle: "bottomRight", point: bottomRight },
      { handle: "bottomLeft", point: bottomLeft },
    ];
  }

  override parameterHandles(shape: ParallelogramObject): ShapeParameterHandle[] {
    const [topLeft, topRight] = this.points(shape);
    return [{ parameter: "slantRatio", point: this.interpolate(topLeft, topRight, 0.35) }];
  }

  override setParameter(
    shape: ParallelogramObject,
    parameter: ShapeParameterName,
    point: CanvasPoint,
  ): void {
    if (parameter === "slantRatio") {
      const ratio = (point.x / Math.max(shape.width, 0.001) - 0.35) / 0.65;
      shape.slantRatio = Math.max(0, Math.min(0.45, ratio));
    }
  }

  override parameterValue(shape: ParallelogramObject, parameter: ShapeParameterName): number {
    return parameter === "slantRatio" ? shape.slantRatio : 0;
  }

  override parameterDelta(
    shape: ParallelogramObject,
    parameter: ShapeParameterName,
    previousPoint: CanvasPoint,
    point: CanvasPoint,
  ): number {
    return parameter === "slantRatio"
      ? (point.x - previousPoint.x) / Math.max(shape.width * 0.65, 0.001)
      : 0;
  }

  override setParameterValue(
    shape: ParallelogramObject,
    parameter: ShapeParameterName,
    value: number,
  ): void {
    if (parameter === "slantRatio") {
      shape.slantRatio = Math.max(0, Math.min(0.45, value));
    }
  }
}
