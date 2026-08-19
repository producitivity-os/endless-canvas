import type { BaseElement, CanvasElement, Point } from "./types";

export abstract class Element implements BaseElement {
  abstract readonly type: CanvasElement["type"] | "arrow";
  id: string; x: number; y: number; width: number; height: number; rotation?: number;

  protected constructor(init: BaseElement) {
    this.id = init.id; this.x = init.x; this.y = init.y; this.width = init.width; this.height = init.height; this.rotation = init.rotation;
  }

  moveTo(point: Point) { this.x = point.x; this.y = point.y; }
  translate(dx: number, dy: number) { this.x += dx; this.y += dy; }
  bounds() { return { x: this.x, y: this.y, width: this.width, height: this.height }; }
}

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

export type ShapeInit = BaseElement & { fill: number; stroke: number; strokeWidth?: number; opacity?: number; fillStyle?: "solid" | "hachure" | "cross-hatch" | "none" };

export abstract class Shape extends Element {
  fill: number; stroke: number; strokeWidth?: number; opacity?: number; fillStyle?: "solid" | "hachure" | "cross-hatch" | "none";

  protected constructor(init: ShapeInit) {
    super(init); this.fill = init.fill; this.stroke = init.stroke; this.strokeWidth = init.strokeWidth; this.opacity = init.opacity; this.fillStyle = init.fillStyle;
  }
}

export class RectangleElement extends Shape {
  readonly type = "rect" as const;
  cornerRadius?: number;
  constructor(init: ShapeInit & { cornerRadius?: number }) { super(init); this.cornerRadius = init.cornerRadius; }
}

export class EllipseElement extends Shape {
  readonly type = "ellipse" as const;
  constructor(init: ShapeInit) { super(init); }
}

export class ImageElement extends Element {
  readonly type = "image" as const;
  src: string; name?: string; crop?: { x: number; y: number; width: number; height: number }; previewSrc?: string;
  uploadStatus?: "uploading" | "ready" | "failed"; lockAspectRatio?: boolean; opacity?: number; cornerRadius?: number;
  constructor(init: BaseElement & Omit<ImageElement, keyof Element | "type" | "moveTo" | "translate" | "bounds">) {
    super(init); this.src = init.src; this.name = init.name; this.crop = init.crop; this.previewSrc = init.previewSrc; this.uploadStatus = init.uploadStatus; this.lockAspectRatio = init.lockAspectRatio; this.opacity = init.opacity; this.cornerRadius = init.cornerRadius;
  }
}

export class PathElement {
  readonly type = "path" as const;
  id: string; points: Point[]; color: number; width: number; rotation?: number;
  constructor(init: Extract<CanvasElement, { type: "path" }>) { this.id = init.id; this.points = init.points; this.color = init.color; this.width = init.width; this.rotation = init.rotation; }
  translate(dx: number, dy: number) { for (const point of this.points) { point.x += dx; point.y += dy; } }
}

export class SelectionFrame extends RectangleElement {
  readonly selectionColor: number;
  readonly handleSize: number;
  constructor(target: BaseElement, selectionColor = 0x4f7fe8, handleSize = 9) {
    super({ ...target, fill: 0xffffff, stroke: selectionColor, fillStyle: "none", strokeWidth: 1.75 });
    this.selectionColor = selectionColor; this.handleSize = handleSize;
  }
}

export function hydrateElement(element: CanvasElement): CanvasElement {
  if (element instanceof Element || element instanceof PathElement) return element;
  if (element.type === "rect") return new RectangleElement(element);
  if (element.type === "ellipse") return new EllipseElement(element);
  if (element.type === "image") return new ImageElement(element);
  if (element.type === "path") return new PathElement(element) as CanvasElement;
  return element;
}
