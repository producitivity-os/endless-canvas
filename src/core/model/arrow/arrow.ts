import type { CanvasPoint } from "../../types";
import { CanvasObject, type CanvasObjectInit, type CanvasObjectType } from "../object.ts";

export type ArrowHead = "none" | "triangle" | "triangle-outline" | "chicken";
export type ArrowHint = "top" | "right" | "bottom" | "left";
export type ArrowRenderMode = "between" | "over" | "under";

export interface ArrowEndpointBinding {
  objectId: string;
  /** A normalized position in the bound object's unrotated bounds. */
  anchor: CanvasPoint;
  hint?: ArrowHint;
}

export interface ArrowEndpoint {
  /** Last resolved world position. It is also the position used after detaching. */
  point: CanvasPoint;
  binding?: ArrowEndpointBinding;
}

/** A path control stored in the arrow chord's relative coordinate system. */
export interface ArrowRelativeControl {
  along: number;
  offset: number;
}

export type ArrowPath =
  | { type: "straight" }
  | {
      type: "curved";
      controls: [ArrowRelativeControl, ArrowRelativeControl];
    }
  | {
      type: "angular";
      orthogonal: boolean;
      waypoints: ArrowRelativeControl[];
    };

export interface ArrowObjectInit extends CanvasObjectInit {
  start?: ArrowEndpoint;
  end?: ArrowEndpoint;
  path?: ArrowPath;
  renderMode?: ArrowRenderMode;
  startHead?: ArrowHead;
  endHead?: ArrowHead;
  stroke?: number;
  strokeWidth?: number;

  /** Legacy fields accepted while hydrating pre-unification arrow objects. */
  startPoint?: CanvasPoint;
  endPoint?: CanvasPoint;
  fromAnchor?: CanvasPoint;
  toAnchor?: CanvasPoint;
  connectedElementIds?: [string, string];
  routing?: "straight" | "bezier" | "orthogonal";
  bend?: number;
}

export class ArrowObject extends CanvasObject {
  readonly type: CanvasObjectType = "arrow";
  start: ArrowEndpoint;
  end: ArrowEndpoint;
  path: ArrowPath;
  renderMode: ArrowRenderMode;
  startHead: ArrowHead;
  endHead: ArrowHead;
  stroke: number;
  strokeWidth: number;

  constructor(init: ArrowObjectInit) {
    super(init);
    const legacyStart = init.startPoint ?? init.fromAnchor ?? { x: init.x, y: init.y };
    const legacyEnd = init.endPoint ??
      init.toAnchor ?? { x: init.x + init.width, y: init.y + init.height };
    this.start = this.cloneEndpoint(
      init.start ?? this.legacyEndpoint(legacyStart, init.connectedElementIds?.[0]),
    );
    this.end = this.cloneEndpoint(
      init.end ?? this.legacyEndpoint(legacyEnd, init.connectedElementIds?.[1]),
    );
    this.path = init.path ? this.clonePath(init.path) : this.legacyPath(init);
    this.renderMode = init.renderMode ?? "between";
    this.startHead = init.startHead ?? "none";
    this.endHead = init.endHead ?? "triangle";
    this.stroke = init.stroke ?? 0x334155;
    this.strokeWidth = Number.isFinite(init.strokeWidth) ? init.strokeWidth! : 2.5;
    this.updateBounds(this.start.point, this.end.point);
  }

  updateBounds(start = this.start.point, end = this.end.point): void {
    this.x = Math.min(start.x, end.x);
    this.y = Math.min(start.y, end.y);
    this.width = Math.max(1, Math.abs(end.x - start.x));
    this.height = Math.max(1, Math.abs(end.y - start.y));
  }

  override translate(dx: number, dy: number): void {
    if (!this.start.binding) {
      this.start.point.x += dx;
      this.start.point.y += dy;
    }
    if (!this.end.binding) {
      this.end.point.x += dx;
      this.end.point.y += dy;
    }
    this.updateBounds();
  }

  private legacyEndpoint(point: CanvasPoint, objectId?: string): ArrowEndpoint {
    return {
      point: { ...point },
      binding: objectId
        ? {
            objectId,
            anchor: { x: 0.5, y: 0.5 },
          }
        : undefined,
    };
  }

  private legacyPath(init: ArrowObjectInit): ArrowPath {
    if (init.routing === "orthogonal") {
      return { type: "angular", orthogonal: true, waypoints: [] };
    }
    if (init.routing === "bezier" || (init.bend ?? 0) !== 0) {
      const offset = init.bend ?? 0;
      return {
        type: "curved",
        controls: [
          { along: 1 / 3, offset },
          { along: 2 / 3, offset },
        ],
      };
    }
    return { type: "straight" };
  }

  private cloneEndpoint(endpoint: ArrowEndpoint): ArrowEndpoint {
    return {
      point: { ...endpoint.point },
      binding: endpoint.binding
        ? {
            objectId: endpoint.binding.objectId,
            anchor: { ...endpoint.binding.anchor },
            hint: endpoint.binding.hint,
          }
        : undefined,
    };
  }

  private clonePath(path: ArrowPath): ArrowPath {
    if (path.type === "straight") {
      return { type: "straight" };
    }
    if (path.type === "curved") {
      return {
        type: "curved",
        controls: [{ ...path.controls[0] }, { ...path.controls[1] }],
      };
    }
    return {
      type: "angular",
      orthogonal: path.orthogonal,
      waypoints: path.waypoints.map((waypoint) => ({ ...waypoint })),
    };
  }
}
