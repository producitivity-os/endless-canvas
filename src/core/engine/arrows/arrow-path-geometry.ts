import type { ArrowObject, ArrowRelativeControl } from "../../model/arrow/arrow.ts";
import type { CanvasObject } from "../../model/object.ts";
import type { CanvasPoint } from "../../types/geometry.ts";
import { distanceToSegment } from "../utils.ts";
import { arrowBindingResolver } from "./arrow-binding-resolver.ts";

export interface ResolvedArrowPath {
  start: CanvasPoint;
  end: CanvasPoint;
  full: CanvasPoint[];
  visible: CanvasPoint[];
  startGuide: CanvasPoint[];
  endGuide: CanvasPoint[];
  controls: CanvasPoint[];
}

interface BoundaryCut {
  outsideIndex: number;
  point: CanvasPoint;
  guide: CanvasPoint[];
}

export class ArrowPathGeometry {
  resolve(arrow: ArrowObject, objects: readonly CanvasObject[]): ResolvedArrowPath {
    const start = arrowBindingResolver.resolveAndRemember(arrow.start, objects);
    const end = arrowBindingResolver.resolveAndRemember(arrow.end, objects);
    const controls = this.controlPoints(arrow, start, end);
    const full = this.sample(arrow, start, end, controls);
    const startHost = arrow.start.binding
      ? objects.find((object) => object.id === arrow.start.binding?.objectId)
      : undefined;
    const endHost = arrow.end.binding
      ? objects.find((object) => object.id === arrow.end.binding?.objectId)
      : undefined;
    const startCut =
      arrow.renderMode === "between" && startHost
        ? this.boundaryCut(full, startHost)
        : this.emptyCut(full);
    const reversed = [...full].reverse();
    const endCut =
      arrow.renderMode === "between" && endHost
        ? this.boundaryCut(reversed, endHost)
        : this.emptyCut(reversed);
    const middleStart = startCut.outsideIndex;
    const middleEnd = Math.max(middleStart, full.length - endCut.outsideIndex);
    const middle = full.slice(middleStart, middleEnd);
    const visible = this.withoutAdjacentDuplicates([startCut.point, ...middle, endCut.point]);
    return {
      start,
      end,
      full,
      visible,
      startGuide: startCut.guide,
      endGuide: [...endCut.guide].reverse(),
      controls,
    };
  }

  pointForControl(
    control: ArrowRelativeControl,
    start: CanvasPoint,
    end: CanvasPoint,
  ): CanvasPoint {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.max(Math.hypot(dx, dy), 0.001);
    return {
      x: start.x + dx * control.along + (-dy / length) * control.offset,
      y: start.y + dy * control.along + (dx / length) * control.offset,
    };
  }

  relativeControl(point: CanvasPoint, start: CanvasPoint, end: CanvasPoint): ArrowRelativeControl {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = Math.max(dx * dx + dy * dy, 0.001);
    const length = Math.sqrt(lengthSquared);
    const px = point.x - start.x;
    const py = point.y - start.y;
    return {
      along: (px * dx + py * dy) / lengthSquared,
      offset: px * (-dy / length) + py * (dx / length),
    };
  }

  hitTest(
    arrow: ArrowObject,
    objects: readonly CanvasObject[],
    point: CanvasPoint,
    tolerance: number,
  ): boolean {
    const path = this.resolve(arrow, objects).full;
    return path
      .slice(1)
      .some((next, index) => distanceToSegment(point, path[index], next) <= tolerance);
  }

  private controlPoints(arrow: ArrowObject, start: CanvasPoint, end: CanvasPoint): CanvasPoint[] {
    if (arrow.path.type === "curved") {
      return arrow.path.controls.map((control) => this.pointForControl(control, start, end));
    }
    if (arrow.path.type === "angular") {
      if (arrow.path.waypoints.length > 0) {
        return arrow.path.waypoints.map((control) => this.pointForControl(control, start, end));
      }
      if (arrow.path.orthogonal) {
        return [
          { x: (start.x + end.x) / 2, y: start.y },
          { x: (start.x + end.x) / 2, y: end.y },
        ];
      }
    }
    return [];
  }

  private sample(
    arrow: ArrowObject,
    start: CanvasPoint,
    end: CanvasPoint,
    controls: CanvasPoint[],
  ): CanvasPoint[] {
    if (arrow.path.type === "curved" && controls.length === 2) {
      return Array.from({ length: 49 }, (_, index) => {
        const t = index / 48;
        const one = 1 - t;
        return {
          x:
            one ** 3 * start.x +
            3 * one ** 2 * t * controls[0].x +
            3 * one * t ** 2 * controls[1].x +
            t ** 3 * end.x,
          y:
            one ** 3 * start.y +
            3 * one ** 2 * t * controls[0].y +
            3 * one * t ** 2 * controls[1].y +
            t ** 3 * end.y,
        };
      });
    }
    const knots = [start, ...controls, end];
    const sampled: CanvasPoint[] = [];
    for (let index = 1; index < knots.length; index++) {
      const a = knots[index - 1];
      const b = knots[index];
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(2, Math.ceil(distance / 5));
      for (let step = index === 1 ? 0 : 1; step <= steps; step++) {
        const t = step / steps;
        sampled.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
    return sampled;
  }

  private boundaryCut(points: readonly CanvasPoint[], host: CanvasObject): BoundaryCut {
    const first = points[0] ?? { x: 0, y: 0 };
    if (!arrowBindingResolver.contains(host, first)) return this.emptyCut(points);
    for (let index = 1; index < points.length; index++) {
      const outside = points[index];
      if (arrowBindingResolver.contains(host, outside)) continue;
      const boundary = this.boundaryPoint(points[index - 1], outside, host);
      return {
        outsideIndex: index,
        point: boundary,
        guide: this.withoutAdjacentDuplicates([...points.slice(0, index), boundary]),
      };
    }
    const last = points.at(-1) ?? first;
    return {
      outsideIndex: Math.max(0, points.length - 1),
      point: last,
      guide: [...points],
    };
  }

  private boundaryPoint(
    inside: CanvasPoint,
    outside: CanvasPoint,
    host: CanvasObject,
  ): CanvasPoint {
    let low = 0;
    let high = 1;
    for (let iteration = 0; iteration < 28; iteration++) {
      const middle = (low + high) / 2;
      const point = {
        x: inside.x + (outside.x - inside.x) * middle,
        y: inside.y + (outside.y - inside.y) * middle,
      };
      if (arrowBindingResolver.contains(host, point)) low = middle;
      else high = middle;
    }
    return {
      x: inside.x + (outside.x - inside.x) * high,
      y: inside.y + (outside.y - inside.y) * high,
    };
  }

  private emptyCut(points: readonly CanvasPoint[]): BoundaryCut {
    return {
      outsideIndex: 0,
      point: points[0] ?? { x: 0, y: 0 },
      guide: [],
    };
  }

  private withoutAdjacentDuplicates(points: readonly CanvasPoint[]): CanvasPoint[] {
    const result: CanvasPoint[] = [];
    for (const point of points) {
      const previous = result.at(-1);
      if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 0.000001) continue;
      result.push(point);
    }
    return result;
  }
}

export const arrowPathGeometry = new ArrowPathGeometry();
