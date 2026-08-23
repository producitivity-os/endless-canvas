import type { EllipseObject, RectangleObject } from "../../model";
import type { CanvasPoint } from "../../types";
import {
  BaseShapeGeometry,
  type ShapeParameterHandle,
  type ShapeParameterName,
  type ShapeResizeHandle,
} from "./geometry-types.ts";

export class RectangleGeometry extends BaseShapeGeometry<RectangleObject> {
  points(shape: RectangleObject): CanvasPoint[] {
    const radius = Math.max(
      0,
      Math.min(shape.cornerRadius ?? 0, shape.width / 2, shape.height / 2),
    );
    if (radius === 0) {
      return [
        { x: 0, y: 0 },
        { x: shape.width, y: 0 },
        { x: shape.width, y: shape.height },
        { x: 0, y: shape.height },
      ];
    }

    const points: CanvasPoint[] = [];
    const corners = [
      { x: shape.width - radius, y: radius, start: -Math.PI / 2 },
      { x: shape.width - radius, y: shape.height - radius, start: 0 },
      { x: radius, y: shape.height - radius, start: Math.PI / 2 },
      { x: radius, y: radius, start: Math.PI },
    ];
    for (const corner of corners) {
      for (let step = 0; step <= 5; step++) {
        const angle = corner.start + (step / 5) * (Math.PI / 2);
        points.push({
          x: corner.x + Math.cos(angle) * radius,
          y: corner.y + Math.sin(angle) * radius,
        });
      }
    }
    return points;
  }

  resizeHandles(shape: RectangleObject): ShapeResizeHandle[] {
    const radius = Math.max(
      0,
      Math.min(shape.cornerRadius ?? 0, shape.width / 2, shape.height / 2),
    );
    const inset = radius - radius / Math.SQRT2;
    return [
      { handle: "topLeft", point: { x: inset, y: inset } },
      { handle: "topRight", point: { x: shape.width - inset, y: inset } },
      {
        handle: "bottomRight",
        point: { x: shape.width - inset, y: shape.height - inset },
      },
      { handle: "bottomLeft", point: { x: inset, y: shape.height - inset } },
    ];
  }

  override parameterHandles(shape: RectangleObject): ShapeParameterHandle[] {
    const radius = Math.max(
      0,
      Math.min(shape.cornerRadius ?? 0, shape.width / 2, shape.height / 2),
    );
    const maximum = Math.min(shape.width / 2, shape.height / 2);
    const inset = Math.min(8, maximum);
    const visualRadius = Math.min(maximum, radius + inset);
    return [
      {
        parameter: "cornerRadius",
        point: { x: shape.width - visualRadius, y: visualRadius },
      },
    ];
  }

  override parameterValue(shape: RectangleObject, parameter: ShapeParameterName): number {
    return parameter === "cornerRadius" ? (shape.cornerRadius ?? 0) : 0;
  }

  override parameterDelta(
    _shape: RectangleObject,
    parameter: ShapeParameterName,
    previousPoint: CanvasPoint,
    point: CanvasPoint,
  ): number {
    if (parameter !== "cornerRadius") {
      return 0;
    }
    const dx = point.x - previousPoint.x;
    const dy = point.y - previousPoint.y;
    return Math.abs(dx) >= Math.abs(dy) ? -dx : dy;
  }

  override setParameterValue(
    shape: RectangleObject,
    parameter: ShapeParameterName,
    value: number,
  ): void {
    if (parameter === "cornerRadius") {
      shape.cornerRadius = Math.max(0, Math.min(value, shape.width / 2, shape.height / 2));
    }
  }

  override setParameter(
    shape: RectangleObject,
    parameter: ShapeParameterName,
    point: CanvasPoint,
  ): void {
    if (parameter === "cornerRadius") {
      this.setParameterValue(shape, parameter, (shape.width - point.x + point.y) / 2);
    }
  }
}

export class EllipseGeometry extends BaseShapeGeometry<EllipseObject> {
  points(shape: EllipseObject): CanvasPoint[] {
    const center = { x: shape.width / 2, y: shape.height / 2 };
    const radiusX = shape.width / 2;
    const radiusY = shape.height / 2;
    const start = -Math.PI / 2;
    const sweep = Math.PI * 2 * shape.arcSweep;
    const steps = Math.max(12, Math.ceil(64 * shape.arcSweep));
    const arc = Array.from({ length: steps + 1 }, (_, index) => {
      const angle = start + (index / steps) * sweep;
      return {
        x: center.x + Math.cos(angle) * radiusX,
        y: center.y + Math.sin(angle) * radiusY,
      };
    });
    return shape.arcSweep >= 0.999 ? arc : [center, ...arc];
  }

  resizeHandles(shape: EllipseObject): ShapeResizeHandle[] {
    return [
      { handle: "top", point: { x: shape.width / 2, y: 0 } },
      { handle: "left", point: { x: 0, y: shape.height / 2 } },
    ];
  }

  override parameterHandles(shape: EllipseObject): ShapeParameterHandle[] {
    const angle = -Math.PI / 2 + Math.PI * 2 * shape.arcSweep;
    return [
      {
        parameter: "arcSweep",
        point: {
          x: shape.width / 2 + Math.cos(angle) * (shape.width / 2),
          y: shape.height / 2 + Math.sin(angle) * (shape.height / 2),
        },
      },
    ];
  }

  override setParameter(
    shape: EllipseObject,
    parameter: ShapeParameterName,
    point: CanvasPoint,
  ): void {
    if (parameter !== "arcSweep") {
      return;
    }
    const normalizedX = (point.x - shape.width / 2) / Math.max(shape.width / 2, 0.001);
    const normalizedY = (point.y - shape.height / 2) / Math.max(shape.height / 2, 0.001);
    let angle = Math.atan2(normalizedY, normalizedX) + Math.PI / 2;
    if (angle <= 0) {
      angle += Math.PI * 2;
    }
    shape.arcSweep = Math.max(0.01, Math.min(1, angle / (Math.PI * 2)));
  }

  override parameterValue(shape: EllipseObject, parameter: ShapeParameterName): number {
    return parameter === "arcSweep" ? shape.arcSweep : 0;
  }

  override parameterDelta(
    shape: EllipseObject,
    parameter: ShapeParameterName,
    previousPoint: CanvasPoint,
    point: CanvasPoint,
  ): number {
    if (parameter !== "arcSweep") {
      return 0;
    }
    const angleFor = (value: CanvasPoint) =>
      Math.atan2(
        (value.y - shape.height / 2) / Math.max(shape.height / 2, 0.001),
        (value.x - shape.width / 2) / Math.max(shape.width / 2, 0.001),
      );
    let delta = angleFor(point) - angleFor(previousPoint);
    if (delta > Math.PI) {
      delta -= Math.PI * 2;
    } else if (delta < -Math.PI) {
      delta += Math.PI * 2;
    }
    return delta / (Math.PI * 2);
  }

  override setParameterValue(
    shape: EllipseObject,
    parameter: ShapeParameterName,
    value: number,
  ): void {
    if (parameter === "arcSweep") {
      shape.arcSweep = Math.max(0.01, Math.min(1, value));
    }
  }
}
