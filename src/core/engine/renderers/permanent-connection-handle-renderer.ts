import { Container, Graphics } from "pixi.js";
import type { ArrowHint, ArrowObject, CanvasObject } from "../../model/index.ts";
import type { EndlessCanvasRuntimeState } from "../../types/runtime.ts";
import type { CanvasObjectExtension } from "../../types/extensions.ts";
import { CanvasObjectExtensionRegistry } from "../../runtime/object-extension-registry.ts";
import { arrowBindingResolver } from "../arrows/arrow-binding-resolver.ts";

export class PermanentConnectionHandleRenderer {
  private readonly extensions: CanvasObjectExtensionRegistry;
  private readonly views = new WeakMap<Container, Container>();

  constructor(extensions: readonly CanvasObjectExtension<any>[] = []) {
    this.extensions = new CanvasObjectExtensionRegistry(extensions);
  }

  render(
    target: Container,
    object: CanvasObject,
    runtime: EndlessCanvasRuntimeState,
    scale: number,
    interactionColor = 0x3b82f6,
  ): void {
    let view = this.views.get(target);
    if (!view) {
      view = new Container();
      this.views.set(target, view);
    }
    for (const child of view.removeChildren()) child.destroy({ children: true });
    if (!this.extensions.hasPermanentConnectionHandles(object)) {
      view.removeFromParent();
      return;
    }

    const hints = this.hintsFor(object);
    if (runtime.selection?.isSelected(object.id)) {
      const outline = this.selectionOutline(object, scale, interactionColor);
      if (outline) view.addChild(outline);
    }
    const preview = runtime.arrowPreview;
    const activeHint =
      preview?.arrow.start.binding?.objectId === object.id
        ? this.hintForEndpoint(preview.arrow.start, object, hints)
        : null;
    for (const hint of hints) {
      const hovered =
        (preview?.hintObjectId ?? runtime.arrowHintObjectId) === object.id &&
        (preview?.hotHint ?? runtime.arrowHotHint) === hint.hint;
      view.addChild(this.handle(hint.point, scale, hovered, activeHint === hint.hint, hint.shape));
    }
    target.addChild(view);
  }

  dispose(target: Container): void {
    const view = this.views.get(target);
    if (!view) return;
    view.destroy({ children: true });
    this.views.delete(target);
  }

  private hintsFor(object: CanvasObject): Array<{
    hint: ArrowHint;
    point: { x: number; y: number };
    anchor: { x: number; y: number };
    shape?: "circle" | "rounded-rectangle";
  }> {
    const handles = this.extensions.connectionHandles(object);
    return handles
      ? arrowBindingResolver.hintsFrom(object, handles)
      : arrowBindingResolver.hints(object);
  }

  private hintForEndpoint(
    endpoint: ArrowObject["start"],
    object: CanvasObject,
    hints: ReturnType<PermanentConnectionHandleRenderer["hintsFor"]>,
  ): ArrowHint | null {
    const stored = endpoint.binding?.hint;
    if (stored && hints.some((hint) => hint.hint === stored)) return stored;
    if (hints.length === 0) return null;
    const point = endpoint.binding
      ? arrowBindingResolver.resolve(endpoint, [object])
      : endpoint.point;
    return hints.reduce((nearest, candidate) =>
      Math.hypot(candidate.point.x - point.x, candidate.point.y - point.y) <
      Math.hypot(nearest.point.x - point.x, nearest.point.y - point.y)
        ? candidate
        : nearest,
    ).hint;
  }

  private handle(
    point: { x: number; y: number },
    scale: number,
    hovered: boolean,
    active: boolean,
    shape: "circle" | "rounded-rectangle" = "circle",
  ): Graphics {
    const chromeScale = 1 / Math.max(scale, 0.001);
    const highlighted = hovered || active;
    const radius = (active ? 6 : hovered ? 5.5 : 5) * chromeScale;
    const handle = new Graphics();
    if (shape === "rounded-rectangle")
      handle.roundRect(-radius * 0.72, -radius, radius * 1.44, radius * 2, radius * 0.62);
    else handle.circle(0, 0, radius);
    handle.fill({ color: 0xffffff }).stroke({
      color: highlighted ? 0x3b82f6 : 0x9ca3af,
      width: (highlighted ? 2.25 : 1.5) * chromeScale,
    });
    handle.position.set(point.x, point.y);
    return handle;
  }

  private selectionOutline(object: CanvasObject, scale: number, color: number): Container | null {
    const geometry = this.extensions.selectionGeometry(object);
    if (!geometry || geometry.shape === "none") return null;
    const chromeScale = 1 / Math.max(scale, 0.001);
    const outline = new Graphics();
    if (geometry.shape === "ellipse") {
      outline.ellipse(object.width / 2, object.height / 2, object.width / 2, object.height / 2);
    } else if (geometry.shape === "diamond") {
      outline
        .moveTo(object.width / 2, 0)
        .lineTo(object.width, object.height / 2)
        .lineTo(object.width / 2, object.height)
        .lineTo(0, object.height / 2)
        .closePath();
    } else {
      outline.roundRect(0, 0, object.width, object.height, geometry.radius ?? 0);
    }
    outline.stroke({
      color: geometry.strokeColor ?? color,
      width: (geometry.strokeWidth ?? 4) * chromeScale,
      join: "round",
    });
    const root = new Container();
    root.position.set(object.x + object.width / 2, object.y + object.height / 2);
    root.pivot.set(object.width / 2, object.height / 2);
    root.rotation = object.rotation;
    root.addChild(outline);
    return root;
  }
}
