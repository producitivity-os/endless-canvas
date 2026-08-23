import type { ArrowHead } from "../../model";
import type { CanvasPoint } from "../../types";

export const arrowHeadLength = 12;
export const arrowHeadSpread = 7;

export interface ResolvedArrowHead {
  tip: CanvasPoint;
  base: CanvasPoint;
  left: CanvasPoint;
  right: CanvasPoint;
}

export class ArrowHeadGeometry {
  resolve(tip: CanvasPoint, from: CanvasPoint): ResolvedArrowHead {
    const angle = Math.atan2(tip.y - from.y, tip.x - from.x);
    const base = {
      x: tip.x - Math.cos(angle) * arrowHeadLength,
      y: tip.y - Math.sin(angle) * arrowHeadLength,
    };
    return {
      tip,
      base,
      left: {
        x: base.x + Math.cos(angle + Math.PI / 2) * arrowHeadSpread,
        y: base.y + Math.sin(angle + Math.PI / 2) * arrowHeadSpread,
      },
      right: {
        x: base.x + Math.cos(angle - Math.PI / 2) * arrowHeadSpread,
        y: base.y + Math.sin(angle - Math.PI / 2) * arrowHeadSpread,
      },
    };
  }

  trimDistance(head: ArrowHead): number {
    return head === "none" ? 0 : arrowHeadLength;
  }

  trimPath(
    points: readonly CanvasPoint[],
    startDistance: number,
    endDistance: number,
  ): CanvasPoint[] {
    return this.trimStart(
      [...this.trimStart([...points].reverse(), endDistance)].reverse(),
      startDistance,
    );
  }

  private trimStart(points: CanvasPoint[], distance: number): CanvasPoint[] {
    if (distance <= 0 || points.length < 2) return points;
    let remaining = distance;
    for (let index = 1; index < points.length; index++) {
      const start = points[index - 1];
      const end = points[index];
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      if (length <= remaining) {
        remaining -= length;
        continue;
      }
      const amount = remaining / Math.max(length, 0.000001);
      return [
        {
          x: start.x + (end.x - start.x) * amount,
          y: start.y + (end.y - start.y) * amount,
        },
        ...points.slice(index),
      ];
    }
    const last = points.at(-1);
    return last ? [last] : [];
  }
}

export const arrowHeadGeometry = new ArrowHeadGeometry();
