function elementPosition(element: CanvasElement): Point { if (element.type !== "path") return { x: element.x, y: element.y }; return { x: Math.min(...element.points.map((point) => point.x)), y: Math.min(...element.points.map((point) => point.y)) }; }
export class ElementDragTarget implements Draggable {
  constructor(private readonly element: CanvasElement) { }
  get id() { return this.element.id; }
  position() { return elementPosition(this.element); }
  moveTo(position: Point) { const origin = elementPosition(this.element); const dx = position.x - origin.x; const dy = position.y - origin.y; if (this.element.type === "path") for (const point of this.element.points) { point.x += dx; point.y += dy; } else { this.element.x += dx; this.element.y += dy; } }
}

export interface Draggable { readonly id: string; position(): Point; moveTo(position: Point): void; }
export class DragSession {
  private readonly origins = new Map<string, { target: Draggable; position: Point }>();
  constructor(private readonly pointerOrigin: Point, targets: Iterable<Draggable>) { for (const target of targets) this.origins.set(target.id, { target, position: target.position() }); }
  move(pointer: Point) { const dx = pointer.x - this.pointerOrigin.x; const dy = pointer.y - this.pointerOrigin.y; for (const { target, position } of this.origins.values()) target.moveTo({ x: position.x + dx, y: position.y + dy }); }
}
