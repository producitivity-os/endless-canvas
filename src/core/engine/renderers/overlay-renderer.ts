import { Container, Graphics } from "pixi.js";
import type { ArrowObject, CanvasObject, ImageObject, PathObject } from "../../model";
import type { EndlessCanvasRuntimeState, EndlessCanvasState } from "../../types";
import { boxGeometry } from "../box-geometry";
import { arrowBindingResolver, arrowPathGeometry } from "../arrows";
import { shapeGeometry } from "../shapes";
import { theme } from "../theme";
import { selectionHandles } from "./selection-handles";
import { ImageLabelRenderer } from "./image-label-renderer";
import { ArrowRenderer } from "./arrow-renderer";

export interface SelectionRenderOptions {
  handles?: boolean;
  rotation?: boolean;
}

export function objectSelectionBounds(object: CanvasObject, chromeScale: number) {
  if (object.type === "card") {
    const { radius, outline } = theme.elements.card;
    const padding = (outline.padding / 2) * chromeScale;
    return {
      width: object.width + padding * 2,
      height: object.height + padding * 2,
      radius: radius * chromeScale,
      color: theme.interaction.hoverColor,
      strokeWidth: outline.width * chromeScale,
    };
  }

  const padding = 2 * chromeScale;
  return {
    width: object.width + padding * 2,
    height: object.height + padding * 2,
    radius: object.type === "ellipse" ? Math.min(object.width, object.height) / 2 : 6 * chromeScale,
    color: theme.interaction.hoverColor,
    strokeWidth: theme.interaction.frameWidth * chromeScale,
  };
}

export class OverlayRenderer {
  private readonly imageLabels = new ImageLabelRenderer();
  private readonly arrowRenderer = new ArrowRenderer();

  render(
    target: Container,
    state: EndlessCanvasState,
    runtime: EndlessCanvasRuntimeState,
    scale: number,
  ): void {
    for (const id of runtime.selection.objects) {
      const object = state.objects.find((candidate) => candidate.id === id);
      if (object && runtime.imageCrop?.imageId === object.id && object.type === "image") {
        this.drawCropOverlay(target, object as ImageObject, runtime.imageCrop, scale);
      } else if (object) {
        this.renderSelection(target, object, state.objects, scale);
      }
    }
    if (runtime.hoveredObjectId && !runtime.selection.isSelected(runtime.hoveredObjectId)) {
      const hovered = state.objects.find((object) => object.id === runtime.hoveredObjectId);
      if (hovered?.type === "arrow") {
        const arrow = hovered as ArrowObject;
        const path = arrowPathGeometry.resolve(arrow, state.objects);
        this.drawDashedGuide(target, path.startGuide, scale);
        this.drawDashedGuide(target, path.endGuide, scale);
        this.drawEndpointHandles(target, [path.start, path.end], scale);
      }
    }
    const labelledImages = new Set(runtime.selection.objects);
    if (runtime.hoveredObjectId) {
      labelledImages.add(runtime.hoveredObjectId);
    }
    if (runtime.imageCrop) {
      labelledImages.add(runtime.imageCrop.imageId);
    }
    for (const id of labelledImages) {
      const object = state.objects.find((candidate) => candidate.id === id);
      if (object?.type === "image") {
        const image = object as ImageObject;
        const chromeScale = 1 / Math.max(scale, 0.001);
        const crop = runtime.imageCrop?.imageId === image.id ? runtime.imageCrop : null;
        const selected = runtime.selection.isSelected(image.id);
        const padding = selected && !crop ? 2 * chromeScale : 0;
        const frame = crop?.frame ?? {
          x: -padding,
          y: -padding,
          width: image.width + padding * 2,
          height: image.height + padding * 2,
        };
        this.imageLabels.render(
          target,
          image,
          scale,
          frame,
          crop?.frame ?? { x: 0, y: 0, width: image.width, height: image.height },
        );
      }
    }
    this.renderCreationPreview(target, runtime, scale);
    this.renderArrowPreview(target, state, runtime, scale);
    this.renderArrowHints(target, state, runtime, scale);
    this.renderMarquee(target, runtime, scale);
  }

  private drawCropOverlay(
    target: Container,
    object: ImageObject,
    crop: NonNullable<EndlessCanvasRuntimeState["imageCrop"]>,
    scale: number,
  ): void {
    const chromeScale = 1 / Math.max(scale, 0.001);
    const root = new Container();
    root.addChild(
      new Graphics()
        .rect(crop.source.x, crop.source.y, crop.source.width, crop.source.height)
        .stroke({ color: 0x64748b, width: chromeScale, alpha: 0.65 })
        .rect(crop.frame.x, crop.frame.y, crop.frame.width, crop.frame.height)
        .stroke({
          color: theme.interaction.hoverColor,
          width: theme.interaction.frameWidth * chromeScale,
        }),
    );
    const corners = [
      { x: crop.frame.x, y: crop.frame.y, sx: 1, sy: 1 },
      { x: crop.frame.x + crop.frame.width, y: crop.frame.y, sx: -1, sy: 1 },
      { x: crop.frame.x + crop.frame.width, y: crop.frame.y + crop.frame.height, sx: -1, sy: -1 },
      { x: crop.frame.x, y: crop.frame.y + crop.frame.height, sx: 1, sy: -1 },
    ];
    for (const point of corners) {
      const arm = 18 * chromeScale;
      const handle = new Graphics()
        .moveTo(point.sx * arm, 0)
        .lineTo(0, 0)
        .lineTo(0, point.sy * arm)
        .stroke({
          color: theme.interaction.hoverColor,
          width: 4 * chromeScale,
          cap: "square",
          join: "miter",
        });
      handle.position.set(point.x, point.y);
      root.addChild(handle);
    }
    root.position.set(object.x + object.width / 2, object.y + object.height / 2);
    root.pivot.set(object.width / 2, object.height / 2);
    root.rotation = object.rotation;
    target.addChild(root);
  }

  private renderSelection(
    target: Container,
    object: CanvasObject,
    objects: readonly CanvasObject[],
    scale: number,
  ): void {
    if (object.type === "path") {
      this.drawPathEndpoints(target, object as PathObject, scale);
      return;
    }
    if (object.type === "arrow") {
      this.drawArrowControls(target, object as ArrowObject, objects, scale);
      return;
    }

    if (shapeGeometry.isShape(object)) {
      this.drawResizeHandles(target, object, scale);
      this.drawParameterHandles(target, object, scale);
      this.drawRotationHandle(target, object, scale);
      return;
    }

    this.drawSelectionFrame(target, object, scale);
    this.drawResizeHandles(target, object, scale);
    this.drawRotationHandle(target, object, scale);
  }

  private drawSelectionFrame(target: Container, object: CanvasObject, scale: number): void {
    const chromeScale = 1 / Math.max(scale, 0.001);
    const bounds = objectSelectionBounds(object, chromeScale);
    const center = boxGeometry.center(object);
    const frame = new Graphics()
      .roundRect(-bounds.width / 2, -bounds.height / 2, bounds.width, bounds.height, bounds.radius)
      .stroke({ color: bounds.color, width: bounds.strokeWidth });
    frame.position.set(center.x, center.y);
    frame.rotation = object.rotation;
    target.addChild(frame);
  }

  private drawResizeHandles(target: Container, object: CanvasObject, scale: number): void {
    const chromeScale = 1 / Math.max(scale, 0.001);
    for (const descriptor of selectionHandles.descriptors(object)) {
      const size = descriptor.size * chromeScale;
      const handle = new Graphics();
      if (descriptor.appearance === "circle") {
        handle.circle(0, 0, size / 2);
      } else {
        handle.rect(-size / 2, -size / 2, size, size);
      }
      handle.fill({ color: 0xffffff }).stroke({
        color: theme.interaction.hoverColor,
        width: 2 * chromeScale,
      });
      const point = selectionHandles.resizePoint(object, descriptor);
      handle.position.set(point.x, point.y);
      handle.rotation = object.rotation;
      target.addChild(handle);
    }
  }

  private drawRotationHandle(target: Container, object: CanvasObject, scale: number): void {
    const point = selectionHandles.rotationPoint(object, scale);
    if (!point) {
      return;
    }
    const chromeScale = 1 / Math.max(scale, 0.001);
    const handle = new Graphics()
      .circle(0, 0, 6 * chromeScale)
      .fill({ color: 0xffffff })
      .stroke({ color: theme.interaction.hoverColor, width: 2 * chromeScale });
    handle.position.set(point.x, point.y);
    target.addChild(handle);
  }

  private drawParameterHandles(target: Container, object: CanvasObject, scale: number): void {
    const chromeScale = 1 / Math.max(scale, 0.001);
    for (const descriptor of selectionHandles.parameterDescriptors(object)) {
      const size = descriptor.size * chromeScale;
      const handle = new Graphics()
        .circle(0, 0, size / 2)
        .fill({ color: 0xffffff })
        .stroke({ color: theme.interaction.hoverColor, width: 2 * chromeScale });
      const point = selectionHandles.parameterPoint(object, descriptor);
      handle.position.set(point.x, point.y);
      target.addChild(handle);
    }
  }

  private drawPathEndpoints(target: Container, path: PathObject, scale: number): void {
    if (path.points.length < 2) {
      return;
    }
    this.drawEndpointHandles(target, [path.points[0], path.points[path.points.length - 1]], scale);
  }

  private drawArrowControls(
    target: Container,
    arrow: ArrowObject,
    objects: readonly CanvasObject[],
    scale: number,
  ): void {
    const path = arrowPathGeometry.resolve(arrow, objects);
    this.drawDashedGuide(target, path.startGuide, scale);
    this.drawDashedGuide(target, path.endGuide, scale);
    this.drawEndpointHandles(target, [path.start, path.end], scale);
    const center = path.full[Math.floor(path.full.length / 2)];
    if (center) this.drawSplineHandle(target, center, scale, true);
  }

  private drawSplineHandle(
    target: Container,
    point: { x: number; y: number },
    scale: number,
    center: boolean,
  ): void {
    const chromeScale = 1 / Math.max(scale, 0.001);
    const handle = new Graphics()
      .circle(0, 0, (center ? 4.5 : 3.75) * chromeScale)
      .fill({ color: 0xffffff })
      .stroke({ color: theme.interaction.hoverColor, width: 1.75 * chromeScale });
    handle.position.set(point.x, point.y);
    target.addChild(handle);
  }

  private drawDashedGuide(
    target: Container,
    points: readonly { x: number; y: number }[],
    scale: number,
  ): void {
    if (points.length < 2) return;
    const chromeScale = 1 / Math.max(scale, 0.001);
    const graphics = new Graphics();
    for (let index = 1; index < points.length; index++) {
      const a = points[index - 1];
      const b = points[index];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      const parts = Math.max(1, Math.ceil(length / (7 * chromeScale)));
      for (let part = 0; part < parts; part += 2) {
        const start = part / parts;
        const end = Math.min(1, (part + 1) / parts);
        graphics
          .moveTo(a.x + (b.x - a.x) * start, a.y + (b.y - a.y) * start)
          .lineTo(a.x + (b.x - a.x) * end, a.y + (b.y - a.y) * end);
      }
    }
    graphics.stroke({ color: 0x94a3b8, width: 1.25 * chromeScale, alpha: 0.9 });
    target.addChild(graphics);
  }

  private drawEndpointHandles(
    target: Container,
    points: readonly { x: number; y: number }[],
    scale: number,
  ): void {
    const chromeScale = 1 / Math.max(scale, 0.001);
    for (const point of points) {
      const handle = new Graphics()
        .circle(0, 0, 4.5 * chromeScale)
        .fill({ color: 0xffffff })
        .stroke({ color: theme.interaction.hoverColor, width: 1.75 * chromeScale });
      handle.position.set(point.x, point.y);
      target.addChild(handle);
    }
  }

  private renderCreationPreview(
    target: Container,
    runtime: EndlessCanvasRuntimeState,
    scale: number,
  ): void {
    const preview = runtime.creationPreview;
    if (!preview) {
      return;
    }
    const chromeScale = 1 / Math.max(scale, 0.001);
    const graphics = new Graphics();
    if (preview.type === "box") {
      const x = Math.min(preview.origin.x, preview.current.x);
      const y = Math.min(preview.origin.y, preview.current.y);
      const width = Math.max(1, Math.abs(preview.current.x - preview.origin.x));
      const height = Math.max(1, Math.abs(preview.current.y - preview.origin.y));
      if (preview.tool === "ellipse") {
        graphics.ellipse(x + width / 2, y + height / 2, width / 2, height / 2);
      } else if (preview.tool === "diamond") {
        graphics
          .moveTo(x + width / 2, y)
          .lineTo(x + width, y + height / 2)
          .lineTo(x + width / 2, y + height)
          .lineTo(x, y + height / 2)
          .closePath();
      } else if (preview.tool === "pentagon") {
        graphics
          .moveTo(x + width / 2, y)
          .lineTo(x + width, y + height * 0.38)
          .lineTo(x + width * 0.82, y + height)
          .lineTo(x + width * 0.18, y + height)
          .lineTo(x, y + height * 0.38)
          .closePath();
      } else if (preview.tool === "parallelogram") {
        graphics
          .moveTo(x + width * 0.2, y)
          .lineTo(x + width, y)
          .lineTo(x + width * 0.8, y + height)
          .lineTo(x, y + height)
          .closePath();
      } else {
        graphics.roundRect(x, y, width, height, preview.tool === "card" ? 14 : 8);
      }
      graphics
        .fill({ color: theme.interaction.hoverColor, alpha: 0.08 })
        .stroke({ color: theme.interaction.hoverColor, width: 2 * chromeScale, alpha: 0.9 });
    } else if (preview.points[0]) {
      graphics.moveTo(preview.points[0].x, preview.points[0].y);
      for (const point of preview.points.slice(1)) {
        graphics.lineTo(point.x, point.y);
      }
      graphics.stroke({
        color: theme.interaction.hoverColor,
        width: 2.5 * chromeScale,
        cap: "round",
        join: "round",
      });
    }
    target.addChild(graphics);
  }

  private renderArrowPreview(
    target: Container,
    state: EndlessCanvasState,
    runtime: EndlessCanvasRuntimeState,
    scale: number,
  ): void {
    const preview = runtime.arrowPreview;
    if (!preview) return;
    this.arrowRenderer.render(target, preview.arrow, state.objects, {
      scale,
      hovered: true,
      selected: false,
    });
  }

  private renderArrowHints(
    target: Container,
    state: EndlessCanvasState,
    runtime: EndlessCanvasRuntimeState,
    scale: number,
  ): void {
    const objectId = runtime.arrowPreview?.hintObjectId ?? runtime.arrowHintObjectId;
    const hotHint = runtime.arrowPreview?.hotHint ?? runtime.arrowHotHint;
    const object = state.objects.find((candidate) => candidate.id === objectId);
    if (!object || !arrowBindingResolver.canBind(object)) return;
    const chromeScale = 1 / Math.max(scale, 0.001);
    for (const hint of arrowBindingResolver.hints(object)) {
      const hot = hint.hint === hotHint;
      const handle = new Graphics()
        .circle(0, 0, (hot ? 6 : 5) * chromeScale)
        .fill({ color: hot ? theme.interaction.hoverColor : 0xffffff })
        .stroke({ color: theme.interaction.hoverColor, width: 2 * chromeScale });
      handle.position.set(hint.point.x, hint.point.y);
      target.addChild(handle);
    }
  }

  private renderMarquee(
    target: Container,
    runtime: EndlessCanvasRuntimeState,
    scale: number,
  ): void {
    const marquee = runtime.marquee;
    if (!marquee) return;
    const x = Math.min(marquee.origin.x, marquee.current.x);
    const y = Math.min(marquee.origin.y, marquee.current.y);
    const width = Math.abs(marquee.current.x - marquee.origin.x);
    const height = Math.abs(marquee.current.y - marquee.origin.y);
    const chromeScale = 1 / Math.max(scale, 0.001);
    target.addChild(
      new Graphics()
        .rect(x, y, width, height)
        .fill({
          color: theme.interaction.hoverColor,
          alpha: marquee.mode === "contain" ? 0.08 : 0.13,
        })
        .stroke({ color: theme.interaction.hoverColor, width: 1.5 * chromeScale }),
    );
  }
}
