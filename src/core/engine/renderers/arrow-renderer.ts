import { Graphics, type Container } from "pixi.js";
import type { ArrowHead, ArrowObject, CanvasObject } from "../../model";
import type { CanvasPoint } from "../../types";
import { arrowHeadGeometry, arrowPathGeometry } from "../arrows";
import type { CanvasRenderContext } from "./renderer";

export class ArrowRenderer {
  render(
    target: Container,
    arrow: ArrowObject,
    objects: readonly CanvasObject[],
    context: CanvasRenderContext,
  ): void {
    const path = arrowPathGeometry.resolve(arrow, objects);
    if (path.visible.length < 2) return;
    const highlighted = context.selected || context.hovered;
    const color = highlighted ? context.interactionColor : arrow.stroke;
    const width = highlighted
      ? Math.max(arrow.strokeWidth, 2.5 / Math.max(context.scale, 0.001))
      : arrow.strokeWidth;
    const shaft = arrowHeadGeometry.trimPath(
      path.visible,
      arrowHeadGeometry.trimDistance(arrow.startHead),
      arrowHeadGeometry.trimDistance(arrow.endHead),
    );

    if (shaft.length >= 2) {
      const graphics = new Graphics().moveTo(shaft[0].x, shaft[0].y);
      for (const point of shaft.slice(1)) graphics.lineTo(point.x, point.y);
      graphics.stroke({ color, width, cap: "round", join: "round" });
      graphics.alpha = arrow.opacity;
      target.addChild(graphics);
    }

    this.drawHead(target, arrow.startHead, path.visible[0], path.visible[1], color, arrow.opacity);
    this.drawHead(
      target,
      arrow.endHead,
      path.visible[path.visible.length - 1],
      path.visible[path.visible.length - 2],
      color,
      arrow.opacity,
    );
  }

  private drawHead(
    target: Container,
    head: ArrowHead,
    tip: CanvasPoint,
    from: CanvasPoint,
    color: number,
    opacity: number,
  ): void {
    if (head === "none") return;
    const geometry = arrowHeadGeometry.resolve(tip, from);
    const graphics = new Graphics()
      .moveTo(geometry.tip.x, geometry.tip.y)
      .lineTo(geometry.left.x, geometry.left.y);
    if (head === "chicken") {
      graphics.moveTo(geometry.tip.x, geometry.tip.y).lineTo(geometry.right.x, geometry.right.y);
    } else {
      graphics.lineTo(geometry.right.x, geometry.right.y).closePath();
    }
    if (head === "triangle") graphics.fill({ color });
    else graphics.stroke({ color, width: 1.5, join: "round" });
    graphics.alpha = opacity;
    target.addChild(graphics);
  }
}
