import type { CanvasElement, Point } from "@/core/types";

export class PathElement {
  readonly type = "path" as const;
  id: string; points: Point[]; color: number; width: number; rotation?: number;
  constructor(init: Extract<CanvasElement, { type: "path" }>) { this.id = init.id; this.points = init.points; this.color = init.color; this.width = init.width; this.rotation = init.rotation; }
  translate(dx: number, dy: number) { for (const point of this.points) { point.x += dx; point.y += dy; } }
}
