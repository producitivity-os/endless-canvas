import { Graphics, type Container } from "pixi.js";
import type { PathObject } from "../../model";
import type { CanvasRenderContext, ElementRenderer } from "./renderer";

export class PathRenderer implements ElementRenderer<PathObject> {
  render(target: Container, pathObject: PathObject, context: CanvasRenderContext): void {
    if (pathObject.points.length < 2) {
      return;
    }

    const highlighted = context.selected || context.hovered;
    const path = new Graphics().moveTo(pathObject.points[0].x, pathObject.points[0].y);
    for (const point of pathObject.points.slice(1)) {
      path.lineTo(point.x, point.y);
    }
    path.stroke({
      color: highlighted ? context.interactionColor : pathObject.color,
      width: highlighted
        ? Math.max(pathObject.strokeWidth ?? 2.5, 2.5 / Math.max(context.scale, 0.001))
        : (pathObject.strokeWidth ?? 2.5),
      cap: "round",
      join: "round",
    });
    path.alpha = pathObject.opacity;
    target.addChild(path);
  }
}
