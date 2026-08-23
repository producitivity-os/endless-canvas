import { Container, Graphics } from "pixi.js";
import type { BaseShapeObject } from "../../model";
import { shapeGeometry, type CanvasShapeObject } from "../shapes";
import { blendColor, theme } from "../theme";
import type { CanvasRenderContext, ElementRenderer } from "./renderer";

export class ShapeRenderer implements ElementRenderer<BaseShapeObject> {
  render(target: Container, shapeObject: BaseShapeObject, context: CanvasRenderContext): void {
    if (!shapeGeometry.isShape(shapeObject)) {
      return;
    }

    const root = new Container();
    const shape = this.drawOutline(shapeObject);
    const hovered = context.hovered && !context.selected;
    const highlighted = hovered || context.selected;
    const highlightColor = theme.interaction.hoverColor;

    if ((shapeObject.fillStyle ?? "solid") !== "none") {
      shape.fill({
        color: hovered ? blendColor(shapeObject.fill, highlightColor, 0.24) : shapeObject.fill,
        alpha: shapeObject.fillStyle === "solid" || !shapeObject.fillStyle ? 1 : 0.12,
      });
    }
    shape.stroke({
      color: highlighted ? highlightColor : shapeObject.stroke,
      width: highlighted
        ? theme.interaction.frameWidth / Math.max(context.scale, 0.001)
        : (shapeObject.strokeWidth ?? 2),
      join: "round",
    });

    root.addChild(shape);
    root.position.set(
      shapeObject.x + shapeObject.width / 2,
      shapeObject.y + shapeObject.height / 2,
    );
    root.pivot.set(shapeObject.width / 2, shapeObject.height / 2);
    root.rotation = shapeObject.rotation;
    root.alpha = shapeObject.opacity;
    target.addChild(root);
  }

  private drawOutline(shapeObject: CanvasShapeObject): Graphics {
    const points = shapeGeometry.points(shapeObject);
    const graphics = new Graphics();
    if (!points[0]) {
      return graphics;
    }
    graphics.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) {
      graphics.lineTo(point.x, point.y);
    }
    return graphics.closePath();
  }
}
