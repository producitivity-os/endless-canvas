import { boxGeometry } from "../box-geometry.ts";
import { shapeGeometry } from "../shapes/index.ts";
import type { ArrowEndpoint, ArrowHint, CanvasObject } from "../../model/index.ts";
import type { CanvasPoint } from "../../types/geometry.ts";

export interface ArrowSnapResult {
  endpoint: ArrowEndpoint;
  object: CanvasObject | null;
  hotHint: ArrowHint | null;
}

export class ArrowBindingResolver {
  resolve(endpoint: ArrowEndpoint, objects: readonly CanvasObject[]): CanvasPoint {
    const binding = endpoint.binding;
    if (!binding) {
      return { ...endpoint.point };
    }
    const object = objects.find((candidate) => candidate.id === binding.objectId);
    if (!object) {
      return { ...endpoint.point };
    }
    return this.pointForAnchor(object, binding.anchor);
  }

  resolveAndRemember(endpoint: ArrowEndpoint, objects: readonly CanvasObject[]): CanvasPoint {
    const point = this.resolve(endpoint, objects);
    endpoint.point = { ...point };
    return point;
  }

  endpointAt(
    point: CanvasPoint,
    objects: readonly CanvasObject[],
    snapDistance: number,
    customHints?: (object: CanvasObject) => ReturnType<ArrowBindingResolver["hints"]> | null,
  ): ArrowSnapResult {
    const host =
      this.topmostHost(objects, point) ?? this.hostNearHint(objects, point, snapDistance);
    if (!host) {
      return { endpoint: { point: { ...point } }, object: null, hotHint: null };
    }

    const custom = customHints?.(host) ?? null;
    const hints = custom ?? this.hints(host);
    const nearest = hints.reduce<(typeof hints)[number] | null>((result, candidate) => {
      if (!result) return candidate;
      return this.distance(point, candidate.point) < this.distance(point, result.point)
        ? candidate
        : result;
    }, null);
    if (nearest && this.distance(point, nearest.point) <= snapDistance) {
      return {
        endpoint: {
          point: { ...nearest.point },
          binding: {
            objectId: host.id,
            anchor: { ...nearest.anchor },
            hint: nearest.hint,
          },
        },
        object: host,
        hotHint: nearest.hint,
      };
    }

    if (custom) {
      return { endpoint: { point: { ...point } }, object: null, hotHint: null };
    }

    const anchor = this.anchorForPoint(host, point);
    return {
      endpoint: {
        point: { ...point },
        binding: { objectId: host.id, anchor },
      },
      object: host,
      hotHint: null,
    };
  }

  topmostHost(objects: readonly CanvasObject[], point: CanvasPoint): CanvasObject | null {
    for (let index = objects.length - 1; index >= 0; index--) {
      const object = objects[index];
      if (this.canBind(object) && this.contains(object, point)) {
        return object;
      }
    }
    return null;
  }

  canBind(object: CanvasObject): boolean {
    return object.type !== "arrow" && object.type !== "path" && object.capabilities.connectable;
  }

  contains(object: CanvasObject, point: CanvasPoint): boolean {
    if (shapeGeometry.isShape(object)) {
      return shapeGeometry.containsPoint(object, point);
    }
    return boxGeometry.containsPoint(object, object.rotation, point);
  }

  hints(object: CanvasObject): Array<{
    hint: ArrowHint;
    point: CanvasPoint;
    anchor: CanvasPoint;
  }> {
    const candidates: Array<{ hint: ArrowHint; anchor: CanvasPoint }> = [
      { hint: "top", anchor: { x: 0.5, y: 0 } },
      { hint: "right", anchor: { x: 1, y: 0.5 } },
      { hint: "bottom", anchor: { x: 0.5, y: 1 } },
      { hint: "left", anchor: { x: 0, y: 0.5 } },
    ];
    return candidates.map((candidate) => ({
      ...candidate,
      point: this.outlinePoint(object, candidate.hint),
    }));
  }

  hintsFrom(
    object: CanvasObject,
    handles: readonly {
      hint: ArrowHint;
      anchor: CanvasPoint;
      direction?: "input" | "output" | "both";
      shape?: "circle" | "rounded-rectangle";
    }[],
  ): Array<{
    hint: ArrowHint;
    point: CanvasPoint;
    anchor: CanvasPoint;
    direction?: "input" | "output" | "both";
    shape?: "circle" | "rounded-rectangle";
  }> {
    return handles.map((handle) => ({
      ...handle,
      anchor: { ...handle.anchor },
      point: this.pointForAnchor(object, handle.anchor),
    }));
  }

  hintForEndpoint(endpoint: ArrowEndpoint, object: CanvasObject): ArrowHint {
    if (endpoint.binding?.hint) return endpoint.binding.hint;
    const hints = this.hints(object);
    const bindingPoint = endpoint.binding
      ? this.pointForAnchor(object, endpoint.binding.anchor)
      : endpoint.point;
    const target = this.distance(endpoint.point, bindingPoint) > 0.001
      ? endpoint.point
      : bindingPoint;
    return hints.reduce((nearest, candidate) =>
      this.distance(target, candidate.point) < this.distance(target, nearest.point)
        ? candidate
        : nearest,
    ).hint;
  }

  detachMissingBindings(arrows: readonly ArrowEndpoint[], objects: readonly CanvasObject[]): void {
    const objectIds = new Set(objects.map((object) => object.id));
    for (const endpoint of arrows) {
      if (endpoint.binding && !objectIds.has(endpoint.binding.objectId)) {
        endpoint.binding = undefined;
      }
    }
  }

  private outlinePoint(object: CanvasObject, hint: ArrowHint): CanvasPoint {
    if (!shapeGeometry.isShape(object)) {
      const anchor =
        hint === "top"
          ? { x: 0.5, y: 0 }
          : hint === "right"
            ? { x: 1, y: 0.5 }
            : hint === "bottom"
              ? { x: 0.5, y: 1 }
              : { x: 0, y: 0.5 };
      return this.pointForAnchor(object, anchor);
    }

    const localPoints = shapeGeometry.points(object);
    const center = { x: object.width / 2, y: object.height / 2 };
    const direction =
      hint === "top"
        ? { x: 0, y: -1 }
        : hint === "right"
          ? { x: 1, y: 0 }
          : hint === "bottom"
            ? { x: 0, y: 1 }
            : { x: -1, y: 0 };
    let bestDistance = Infinity;
    let best = center;
    for (let index = 0; index < localPoints.length; index++) {
      const a = localPoints[index];
      const b = localPoints[(index + 1) % localPoints.length];
      const edge = { x: b.x - a.x, y: b.y - a.y };
      const denominator = direction.x * edge.y - direction.y * edge.x;
      if (Math.abs(denominator) < 0.000001) continue;
      const relative = { x: a.x - center.x, y: a.y - center.y };
      const rayDistance = (relative.x * edge.y - relative.y * edge.x) / denominator;
      const edgePosition = (relative.x * direction.y - relative.y * direction.x) / denominator;
      if (
        rayDistance >= 0 &&
        edgePosition >= 0 &&
        edgePosition <= 1 &&
        rayDistance < bestDistance
      ) {
        bestDistance = rayDistance;
        best = {
          x: center.x + direction.x * rayDistance,
          y: center.y + direction.y * rayDistance,
        };
      }
    }
    return shapeGeometry.localToWorld(object, best);
  }

  private hostNearHint(
    objects: readonly CanvasObject[],
    point: CanvasPoint,
    snapDistance: number,
  ): CanvasObject | null {
    for (let index = objects.length - 1; index >= 0; index--) {
      const object = objects[index];
      if (
        this.canBind(object) &&
        this.hints(object).some((hint) => this.distance(point, hint.point) <= snapDistance)
      ) {
        return object;
      }
    }
    return null;
  }

  private pointForAnchor(object: CanvasObject, anchor: CanvasPoint): CanvasPoint {
    const center = boxGeometry.center(object);
    return boxGeometry.rotatePoint(
      {
        x: object.x + object.width * anchor.x,
        y: object.y + object.height * anchor.y,
      },
      center,
      object.rotation,
    );
  }

  private anchorForPoint(object: CanvasObject, point: CanvasPoint): CanvasPoint {
    const center = boxGeometry.center(object);
    const local = boxGeometry.rotatePoint(point, center, -object.rotation);
    return {
      x: (local.x - object.x) / Math.max(object.width, 0.001),
      y: (local.y - object.y) / Math.max(object.height, 0.001),
    };
  }

  private distance(a: CanvasPoint, b: CanvasPoint): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
}

export const arrowBindingResolver = new ArrowBindingResolver();
