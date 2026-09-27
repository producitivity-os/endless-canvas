import { arrowBindingResolver } from "../engine/arrows/arrow-binding-resolver.ts";
import { arrowPathGeometry } from "../engine/arrows/arrow-path-geometry.ts";
import { ArrowObject, type ArrowEndpoint, type ArrowHint } from "../model/arrow/arrow.ts";
import type { CanvasObject } from "../model/object.ts";
import { CanvasPropertyDefaults } from "../properties/property-defaults.ts";
import type { CanvasPropertyPatch } from "../properties/types.ts";
import type { CanvasArrowPreview, CanvasPoint } from "../types";

export type ArrowTool = "arrow" | "line";
export type ArrowEditHandle = "start" | "end" | "center" | "body";
type ConnectionHintProvider = (
  object: CanvasObject,
  endpoint: "source" | "target",
) => ReturnType<typeof arrowBindingResolver.hints> | null;

interface ArrowEditSession {
  arrow: ArrowObject;
  handle: ArrowEditHandle;
  pointerStart: CanvasPoint;
  previous: CanvasPoint;
  startPoint: CanvasPoint;
  endPoint: CanvasPoint;
  originalPath: ArrowObject["path"];
  originalStart: ArrowEndpoint;
  originalEnd: ArrowEndpoint;
}

export class CanvasArrowInteraction {
  private readonly defaults: CanvasPropertyDefaults;
  private draft: ArrowObject | null = null;
  private edit: ArrowEditSession | null = null;
  private hintObjectId: string | null = null;
  private hotHint: ArrowHint | null = null;
  private mutated = false;
  private readonly connectionHints?: ConnectionHintProvider;

  constructor(
    defaults: CanvasPropertyDefaults = new CanvasPropertyDefaults(),
    connectionHints?: ConnectionHintProvider,
  ) {
    this.defaults = defaults;
    this.connectionHints = connectionHints;
  }

  get creating(): boolean {
    return this.draft !== null;
  }

  get editing(): boolean {
    return this.edit !== null;
  }

  beginCreation(
    tool: ArrowTool,
    point: CanvasPoint,
    objects: readonly CanvasObject[],
    scale: number,
    exactStart?: ArrowEndpoint,
    overrides?: CanvasPropertyPatch,
  ): void {
    const values = { ...this.defaults.forTool(tool), ...overrides };
    const snappedStart = arrowBindingResolver.endpointAt(
      point,
      objects,
      12 / Math.max(scale, 0.001),
      this.connectionHints ? (object) => this.connectionHints!(object, "source") : undefined,
    );
    const start = exactStart
      ? {
          endpoint: this.cloneEndpoint(exactStart),
          object: null,
          hotHint: exactStart.binding?.hint ?? null,
        }
      : snappedStart;
    this.draft = new ArrowObject({
      id: crypto.randomUUID(),
      type: "arrow",
      x: point.x,
      y: point.y,
      width: 1,
      height: 1,
      rotation: 0,
      opacity: values.opacity ?? 1,
      start: start.endpoint,
      end: { point: { ...point } },
      path: { type: "straight" },
      renderMode: values.renderMode ?? "between",
      startHead: values.startHead ?? "none",
      endHead: values.endHead ?? (tool === "arrow" ? "triangle" : "none"),
      stroke: values.stroke ?? 0x334155,
      strokeWidth: values.strokeWidth ?? 2.5,
    });
    this.hintObjectId = start.object?.id ?? null;
    this.hotHint = start.hotHint;
  }

  updateCreation(point: CanvasPoint, objects: readonly CanvasObject[], scale: number): void {
    if (!this.draft) return;
    const result = arrowBindingResolver.endpointAt(
      point,
      objects,
      12 / Math.max(scale, 0.001),
      this.connectionHints ? (object) => this.connectionHints!(object, "target") : undefined,
    );
    this.draft.end = result.endpoint;
    this.draft.updateBounds(
      arrowBindingResolver.resolve(this.draft.start, objects),
      arrowBindingResolver.resolve(this.draft.end, objects),
    );
    this.hintObjectId = result.object?.id ?? null;
    this.hotHint = result.hotHint;
  }

  finishCreation(objects: readonly CanvasObject[]): ArrowObject | null {
    const draft = this.draft;
    this.draft = null;
    this.clearHint();
    if (!draft) return null;
    const start = arrowBindingResolver.resolve(draft.start, objects);
    const end = arrowBindingResolver.resolve(draft.end, objects);
    if (Math.hypot(end.x - start.x, end.y - start.y) < 3) {
      return null;
    }
    draft.updateBounds(start, end);
    return draft;
  }

  preview(): CanvasArrowPreview | null {
    if (!this.draft) return null;
    return {
      arrow: this.draft,
      hintObjectId: this.hintObjectId,
      hotHint: this.hotHint,
    };
  }

  updateHint(point: CanvasPoint, objects: readonly CanvasObject[], scale: number): boolean {
    const result = arrowBindingResolver.endpointAt(
      point,
      objects,
      12 / Math.max(scale, 0.001),
      this.connectionHints ? (object) => this.connectionHints!(object, "source") : undefined,
    );
    const nextObjectId = result.object?.id ?? null;
    const changed = nextObjectId !== this.hintObjectId || result.hotHint !== this.hotHint;
    this.hintObjectId = nextObjectId;
    this.hotHint = result.hotHint;
    return changed;
  }

  hint(): { objectId: string | null; hotHint: ArrowHint | null } {
    return { objectId: this.hintObjectId, hotHint: this.hotHint };
  }

  hitHandle(
    arrow: ArrowObject,
    objects: readonly CanvasObject[],
    point: CanvasPoint,
    scale: number,
  ): ArrowEditHandle | null {
    const geometry = arrowPathGeometry.resolve(arrow, objects);
    const radius = 10 / Math.max(scale, 0.001);
    if (this.near(point, geometry.start, radius)) return "start";
    if (this.near(point, geometry.end, radius)) return "end";
    const center = geometry.full[Math.floor(geometry.full.length / 2)];
    if (center && this.near(point, center, radius)) return "center";
    return null;
  }

  beginEdit(
    arrow: ArrowObject,
    handle: ArrowEditHandle,
    point: CanvasPoint,
    objects: readonly CanvasObject[],
  ): void {
    const resolved = arrowPathGeometry.resolve(arrow, objects);
    this.edit = {
      arrow,
      handle,
      pointerStart: { ...point },
      previous: { ...point },
      startPoint: { ...resolved.start },
      endPoint: { ...resolved.end },
      originalPath: this.clonePath(arrow.path),
      originalStart: this.cloneEndpoint(arrow.start),
      originalEnd: this.cloneEndpoint(arrow.end),
    };
    this.mutated = false;
  }

  updateEdit(point: CanvasPoint, objects: readonly CanvasObject[], scale: number): boolean {
    const session = this.edit;
    if (!session) return false;
    const { arrow, handle } = session;
    if (handle === "start" || handle === "end") {
      const result = arrowBindingResolver.endpointAt(
        point,
        objects,
        12 / Math.max(scale, 0.001),
        this.connectionHints
          ? (object) => this.connectionHints!(object, handle === "start" ? "source" : "target")
          : undefined,
      );
      arrow[handle] = result.endpoint;
      this.hintObjectId = result.object?.id ?? null;
      this.hotHint = result.hotHint;
    } else if (handle === "center") {
      const relative = arrowPathGeometry.relativeControl(
        point,
        session.startPoint,
        session.endPoint,
      );
      arrow.path = {
        type: "curved",
        controls: [
          { along: 0.25, offset: relative.offset * 1.35 },
          { along: 0.75, offset: relative.offset * 1.35 },
        ],
      };
    } else {
      this.dragBody(session, point);
    }
    const resolved = arrowPathGeometry.resolve(arrow, objects);
    arrow.updateBounds(resolved.start, resolved.end);
    session.previous = { ...point };
    this.mutated = true;
    return true;
  }

  finishEdit(): boolean {
    const changed = this.mutated;
    this.edit = null;
    this.mutated = false;
    this.clearHint();
    return changed;
  }

  cancel(): void {
    this.draft = null;
    if (this.edit) {
      this.edit.arrow.path = this.clonePath(this.edit.originalPath);
      this.edit.arrow.start = this.cloneEndpoint(this.edit.originalStart);
      this.edit.arrow.end = this.cloneEndpoint(this.edit.originalEnd);
      this.edit.arrow.updateBounds(this.edit.startPoint, this.edit.endPoint);
    }
    this.edit = null;
    this.mutated = false;
    this.clearHint();
  }

  private dragBody(session: ArrowEditSession, point: CanvasPoint): void {
    const arrow = session.arrow;
    const dx = point.x - session.previous.x;
    const dy = point.y - session.previous.y;
    let movedEndpoint = false;
    for (const endpoint of [arrow.start, arrow.end]) {
      if (!endpoint.binding) {
        endpoint.point.x += dx;
        endpoint.point.y += dy;
        movedEndpoint = true;
      }
    }
    if (movedEndpoint) return;

    const relativeStart = arrowPathGeometry.relativeControl(
      session.pointerStart,
      session.startPoint,
      session.endPoint,
    );
    const relativeCurrent = arrowPathGeometry.relativeControl(
      point,
      session.startPoint,
      session.endPoint,
    );
    const offset = relativeCurrent.offset - relativeStart.offset;
    if (arrow.path.type === "straight") {
      arrow.path = {
        type: "curved",
        controls: [
          { along: 0.25, offset },
          { along: 0.75, offset },
        ],
      };
    } else if (arrow.path.type === "curved") {
      arrow.path.controls =
        session.originalPath.type === "curved"
          ? [
              {
                ...session.originalPath.controls[0],
                offset: session.originalPath.controls[0].offset + offset,
              },
              {
                ...session.originalPath.controls[1],
                offset: session.originalPath.controls[1].offset + offset,
              },
            ]
          : arrow.path.controls;
    } else if (session.originalPath.type === "angular") {
      arrow.path.waypoints = session.originalPath.waypoints.map((waypoint) => ({
        ...waypoint,
        offset: waypoint.offset + offset,
      }));
    }
  }

  private clearHint(): void {
    this.hintObjectId = null;
    this.hotHint = null;
  }

  private near(a: CanvasPoint, b: CanvasPoint, radius: number): boolean {
    return Math.hypot(a.x - b.x, a.y - b.y) <= radius;
  }

  private clonePath(path: ArrowObject["path"]): ArrowObject["path"] {
    if (path.type === "straight") return { type: "straight" };
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

  private cloneEndpoint(endpoint: ArrowEndpoint): ArrowEndpoint {
    return {
      point: { ...endpoint.point },
      binding: endpoint.binding
        ? { ...endpoint.binding, anchor: { ...endpoint.binding.anchor } }
        : undefined,
    };
  }
}
