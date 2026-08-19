
export type ShapeInit = BaseElement & { fill: number; stroke: number; strokeWidth?: number; opacity?: number; fillStyle?: "solid" | "hachure" | "cross-hatch" | "none" };

export abstract class Shape extends Element {
  fill: number; stroke: number; strokeWidth?: number; opacity?: number; fillStyle?: "solid" | "hachure" | "cross-hatch" | "none";

  protected constructor(init: ShapeInit) {
    super(init); this.fill = init.fill; this.stroke = init.stroke; this.strokeWidth = init.strokeWidth; this.opacity = init.opacity; this.fillStyle = init.fillStyle;
  }
}
