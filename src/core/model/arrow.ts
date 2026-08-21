import type { LinkAppearanceInit } from "../types/canvas";
import type { Point } from "../types/geometry";
import { Element } from "./element";



export type ArrowHead = "none" | "triangle" | "triangle-outline" | "chicken";
export type ArrowRouting = "straight" | "bezier" | "orthogonal";
export type ArrowInit = {
  id?: string; startPoint?: Point; endPoint?: Point; startHead?: ArrowHead; endHead?: ArrowHead;
  connectedElementIds?: [string, string]; routing?: ArrowRouting; bend?: number; strokeWidth?: number;
};

export class Arrow extends Element {
  readonly type = "arrow" as const;
  startPoint: Point; endPoint: Point; startHead: ArrowHead; endHead: ArrowHead;
  connectedElementIds: [string, string]; routing: ArrowRouting; bend: number; strokeWidth: number;

  constructor(init: ArrowInit = {}) {
    const start = init.startPoint ?? { x: 0.5, y: 0.5 }; const end = init.endPoint ?? { x: 0.5, y: 0.5 };
    super({ id: init.id ?? crypto.randomUUID(), x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) });
    this.startPoint = start; this.endPoint = end; this.startHead = init.startHead ?? "none"; this.endHead = init.endHead ?? "none";
    this.connectedElementIds = init.connectedElementIds ?? ["", ""]; this.routing = init.routing ?? "bezier"; this.bend = init.bend ?? 0; this.strokeWidth = init.strokeWidth ?? 2.8;
  }
}
export class BaseArrow extends Arrow {
  fromAnchor: Point; toAnchor: Point;
  constructor(init: LinkAppearanceInit) {
    super({ id: init.id, startPoint: init.fromAnchor, endPoint: init.toAnchor, startHead: init.startHead, endHead: init.endHead, routing: init.routing, bend: init.bend, strokeWidth: init.strokeWidth });
    this.routing = init.routing === "straight" || init.routing === "orthogonal" ? init.routing : "bezier";
    this.startHead = ["triangle", "triangle-outline", "chicken"].includes(init.startHead ?? "") ? init.startHead! : "none";
    this.endHead = ["triangle", "triangle-outline", "chicken"].includes(init.endHead ?? "") ? init.endHead! : "none";
    this.fromAnchor = init.fromAnchor ?? { x: 0.5, y: 0.5 }; this.toAnchor = init.toAnchor ?? { x: 0.5, y: 0.5 };
    this.bend = Number.isFinite(init.bend) ? init.bend! : 0; this.strokeWidth = Number.isFinite(init.strokeWidth) ? init.strokeWidth! : 2.8;
  }
}
export class ElementArrow extends BaseArrow {
  fromElementId: string; toElementId: string; constructor(init: LinkAppearanceInit & { fromElementId: string; toElementId: string }) { super(init); this.fromElementId = init.fromElementId; this.toElementId = init.toElementId; this.connectedElementIds = [init.fromElementId, init.toElementId]; }
}

export type CanvasLinkInit =
  LinkAppearanceInit & {
    fromId: string;
    toId: string;
    label?: string;
  };
export class CanvasLink extends BaseArrow {
  fromId: string;
  toId: string;
  label: string;

  constructor(init: CanvasLinkInit) {
    super(init);
    this.id = init.id ?? crypto.randomUUID();
    this.fromId = init.fromId;
    this.toId = init.toId;
    this.connectedElementIds = [init.fromId, init.toId];
    this.label = init.label ?? "";
  }
}

