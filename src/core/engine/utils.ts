import { Container, Graphics, Rectangle, Sprite, Text } from "pixi.js";
import { drawBrokenImageIcon, imageIsLoading, imageLoadFailed, imageTextureFor } from "@/lib/image";
import { hasLatexCompileError, latexRenderedSize, latexTextureFor } from "@/lib/latex";
import { drawTextElement } from "./text";
import type {
  BaseTextElement,
  CanvasElement,
  CanvasGridStyle,
  CanvasTheme,
  EditState,
  Point,
  ResizeCorner,
} from "./model";

export const detailSelectionColor = 0x4f7fe8;
export const minCardWidth = 24;
export const minCardHeight = 110;
export const fittedCardPadding = 6;
export const illustrationCardPadding = 12;

export function screenToWorld(viewport: Container, x: number, y: number) {
  return { x: (x - viewport.x) / viewport.scale.x, y: (y - viewport.y) / viewport.scale.y };
}

export function normalizeBounds(x1: number, y1: number, x2: number, y2: number) {
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
}

export function resizeBoundsFromCorner(
  corner: ResizeCorner,
  origin: { x: number; y: number; width: number; height: number },
  point: Point,
  minWidth: number,
  minHeight: number,
  preserveAspect: boolean,
) {
  const right = origin.x + origin.width;
  const bottom = origin.y + origin.height;
  if (!preserveAspect) {
    const raw = corner === "topLeft"
      ? { x1: point.x, y1: point.y, x2: right, y2: bottom }
      : corner === "topRight"
        ? { x1: origin.x, y1: point.y, x2: point.x, y2: bottom }
        : corner === "bottomLeft"
          ? { x1: point.x, y1: origin.y, x2: right, y2: point.y }
          : { x1: origin.x, y1: origin.y, x2: point.x, y2: point.y };
    const bounds = normalizeBounds(raw.x1, raw.y1, raw.x2, raw.y2);
    return { x: bounds.x, y: bounds.y, width: Math.max(minWidth, bounds.width), height: Math.max(minHeight, bounds.height) };
  }

  const ratio = origin.width / Math.max(1, origin.height);
  const opposite = corner === "topLeft" ? { x: right, y: bottom } : corner === "topRight" ? { x: origin.x, y: bottom } : corner === "bottomLeft" ? { x: right, y: origin.y } : { x: origin.x, y: origin.y };
  let width = Math.max(minWidth, Math.abs(point.x - opposite.x));
  let height = Math.max(minHeight, Math.abs(point.y - opposite.y));
  if (width / height > ratio) height = width / ratio;
  else width = height * ratio;
  const leftSide = corner === "topLeft" || corner === "bottomLeft";
  const topSide = corner === "topLeft" || corner === "topRight";
  return { x: leftSide ? opposite.x - width : opposite.x, y: topSide ? opposite.y - height : opposite.y, width, height };
}

type Bounds = { x: number; y: number; width: number; height: number };

export function pointInBounds(point: Point, bounds: Bounds) {
  return point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height;
}

export function boundsContainBounds(outer: Bounds, inner: Bounds) {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
}

export function boundsTouchBounds(a: Bounds, b: Bounds) {
  return a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y;
}

export function pathBounds(element: Extract<CanvasElement, { type: "path" }>) {
  const xs = element.points.map((point) => point.x);
  const ys = element.points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return new Rectangle(x, y, Math.max(1, Math.max(...xs) - x), Math.max(1, Math.max(...ys) - y));
}

export function elementBounds(element: CanvasElement) {
  return element.type === "path" ? pathBounds(element) : new Rectangle(element.x, element.y, element.width, element.height);
}

export function fitElementBounds(element: CanvasElement) {
  if (element.type === "text" && !element.text.trim()) return null;
  if (element.type === "image" && !element.src && !element.previewSrc) return null;
  if (element.type === "path" && element.points.length < 2) return null;
  const bounds = elementBounds(element);
  const rotation = element.rotation ?? 0;
  if (!rotation || element.type === "path") return bounds;
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const corners = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ].map((point) => rotatePoint(point, center, rotation));
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return new Rectangle(x, y, Math.max(1, Math.max(...xs) - x), Math.max(1, Math.max(...ys) - y));
}

export function elementCenter(element: CanvasElement) {
  const bounds = elementBounds(element);
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

export function rotatePoint(point: Point, center: Point, rotation: number) {
  if (!rotation) return point;
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  const x = point.x - center.x;
  const y = point.y - center.y;
  return { x: center.x + x * cosine - y * sine, y: center.y + x * sine + y * cosine };
}

export function resizeHandleCenters(element: CanvasElement) {
  const bounds = elementBounds(element);
  const center = elementCenter(element);
  const rotation = element.rotation ?? 0;
  const corners = {
    topLeft: { x: bounds.x, y: bounds.y },
    topRight: { x: bounds.x + bounds.width, y: bounds.y },
    bottomRight: { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    bottomLeft: { x: bounds.x, y: bounds.y + bounds.height },
  };
  return Object.fromEntries(Object.entries(corners).map(([corner, point]) => [corner, rotatePoint(point, center, rotation)])) as Record<ResizeCorner, Point>;
}

export class CanvasEngine {
  drawElement(target: Container, element: CanvasElement, editing?: EditState | null) {
    const rotation = element.rotation ?? 0;
    if (element.type === "text") {
      drawTextElement(target, element, editing, { textureFor: latexTextureFor, renderedSize: latexRenderedSize, hasCompileError: hasLatexCompileError });
      return;
    }
    if (element.type === "rect" || element.type === "ellipse") {
      this.drawShape(target, element, rotation);
      return;
    }
    if (element.type === "image") {
      this.drawImage(target, element, rotation);
      return;
    }
    if (element.points.length > 1) {
      const path = new Graphics();
      path.setStrokeStyle({ color: element.color, width: element.width, cap: "round", join: "round" });
      path.moveTo(element.points[0].x, element.points[0].y);
      for (const point of element.points.slice(1)) path.lineTo(point.x, point.y);
      path.stroke();
      target.addChild(path);
    }
  }

  drawSelectionFrame(target: Graphics, element: CanvasElement, options: { handles: boolean; scale: number; labels?: boolean }) {
    const bounds = elementBounds(element);
    const center = elementCenter(element);
    const rotation = element.rotation ?? 0;
    const chromeScale = 1 / Math.max(0.001, options.scale);
    const isText = element.type === "text";
    const isImage = element.type === "image";
    const isShape = element.type === "rect" || element.type === "ellipse";
    const appearance = isText ? element.selectionAppearance() : isImage || isShape ? { color: detailSelectionColor, frameWidth: 1.75, handleSize: 9, handleWidth: 1.75 } : null;
    const selectionColor = appearance?.color ?? detailSelectionColor;
    const frame = new Graphics();
    frame.position.set(center.x, center.y);
    frame.rotation = rotation;
    frame.rect(-bounds.width / 2, -bounds.height / 2, bounds.width, bounds.height).stroke({ color: selectionColor, width: (appearance?.frameWidth ?? 2.75) * chromeScale });
    target.addChild(frame);

    if (options.labels !== false && isImage) this.drawImageSizeLabel(target, element, bounds, center, rotation, chromeScale);
    if (!options.handles || element.type === "path") return;
    for (const [corner, point] of Object.entries(resizeHandleCenters(element)) as Array<[ResizeCorner, Point]>) {
      const handleWidth = (appearance?.handleSize ?? 14) * chromeScale;
      const resize = new Graphics().roundRect(-handleWidth / 2, -handleWidth / 2, handleWidth, handleWidth, 2.5 * chromeScale).fill({ color: 0xffffff }).stroke({ color: selectionColor, width: (appearance?.handleWidth ?? 4) * chromeScale });
      resize.position.set(point.x, point.y);
      resize.rotation = rotation;
      resize.name = `resize:${element.id}:${corner}`;
      resize.eventMode = "static";
      resize.cursor = corner === "topLeft" || corner === "bottomRight" ? "nwse-resize" : "nesw-resize";
      target.addChild(resize);
    }
    const compactChrome = isText || isImage || isShape;
    const rotate = new Graphics().circle(0, 0, (compactChrome ? 5 : 7) * chromeScale).fill({ color: 0xffffff }).stroke({ color: selectionColor, width: (appearance?.handleWidth ?? 4) * chromeScale });
    rotate.position.set(center.x, center.y - bounds.height / 2 - (compactChrome ? 18 : 28) * chromeScale);
    rotate.name = `rotate:${element.id}`;
    rotate.eventMode = "static";
    rotate.cursor = "grab";
    target.addChild(rotate);
  }

  drawGrid(grid: Graphics, width: number, height: number, viewport: Container, baseStep = 32, style: CanvasGridStyle = "lines", background = 0xf4f6f8, theme: CanvasTheme = "light", opacity = 0.72) {
    const step = baseStep * viewport.scale.x;
    const offsetX = ((viewport.x % step) + step) % step;
    const offsetY = ((viewport.y % step) + step) % step;
    grid.clear();
    grid.rect(0, 0, width, height).fill({ color: background });
    if (style === "none") return;
    const color = theme === "dark" ? 0x454a56 : 0xdfe4ec;
    if (style === "dots") {
      for (let x = offsetX; x < width; x += step) for (let y = offsetY; y < height; y += step) grid.circle(x, y, 1.25).fill({ color, alpha: opacity });
      return;
    }
    grid.setStrokeStyle({ color, width: 1, alpha: opacity });
    for (let x = offsetX; x < width; x += step) grid.moveTo(x, 0).lineTo(x, height);
    for (let y = offsetY; y < height; y += step) grid.moveTo(0, y).lineTo(width, y);
    grid.stroke();
  }

  private drawShape(target: Container, element: Extract<CanvasElement, { type: "rect" | "ellipse" }>, rotation: number) {
    const root = new Container();
    const radius = element.type === "rect" ? Math.min(element.cornerRadius ?? 6, element.width / 2, element.height / 2) : 0;
    const shape = element.type === "rect" ? new Graphics().roundRect(0, 0, element.width, element.height, radius) : new Graphics().ellipse(element.width / 2, element.height / 2, element.width / 2, element.height / 2);
    if ((element.fillStyle ?? "solid") !== "none") shape.fill({ color: element.fill, alpha: element.fillStyle === "solid" || !element.fillStyle ? 1 : 0.12 });
    shape.stroke({ color: element.stroke, width: element.strokeWidth ?? 2 });
    root.addChild(shape);
    if (element.fillStyle === "hachure" || element.fillStyle === "cross-hatch") {
      const hatch = new Graphics();
      for (let offset = -element.height; offset < element.width + element.height; offset += 10) {
        hatch.moveTo(offset, element.height).lineTo(offset + element.height, 0);
        if (element.fillStyle === "cross-hatch") hatch.moveTo(offset, 0).lineTo(offset + element.height, element.height);
      }
      hatch.stroke({ color: element.fill, width: 1.5, alpha: 0.7 });
      const mask = element.type === "rect" ? new Graphics().roundRect(0, 0, element.width, element.height, radius).fill({ color: 0xffffff }) : new Graphics().ellipse(element.width / 2, element.height / 2, element.width / 2, element.height / 2).fill({ color: 0xffffff });
      hatch.mask = mask;
      root.addChild(mask, hatch);
    }
    root.position.set(element.x + element.width / 2, element.y + element.height / 2);
    root.pivot.set(element.width / 2, element.height / 2);
    root.rotation = rotation;
    root.alpha = element.opacity ?? 1;
    target.addChild(root);
  }

  private drawImage(target: Container, element: Extract<CanvasElement, { type: "image" }>, rotation: number) {
    const source = element.previewSrc || element.src;
    const texture = imageTextureFor(source);
    const loading = element.uploadStatus === "uploading" || imageIsLoading(source);
    const root = new Container();
    const radius = Math.max(0, Math.min(element.cornerRadius ?? 0, element.width / 2, element.height / 2));
    root.position.set(element.x + element.width / 2, element.y + element.height / 2);
    root.pivot.set(element.width / 2, element.height / 2);
    root.rotation = rotation;
    if (texture) {
      const sprite = new Sprite(texture);
      const crop = element.crop ?? { x: 0, y: 0, width: 1, height: 1 };
      sprite.width = element.width / Math.max(0.001, crop.width);
      sprite.height = element.height / Math.max(0.001, crop.height);
      sprite.position.set(-crop.x * sprite.width, -crop.y * sprite.height);
      sprite.alpha = element.uploadStatus === "uploading" ? 0.38 : 1;
      const mask = new Graphics().roundRect(0, 0, element.width, element.height, radius).fill({ color: 0xffffff });
      sprite.mask = mask;
      root.addChild(mask, sprite);
    } else {
      const failed = imageLoadFailed(source);
      root.addChild(new Graphics().roundRect(0, 0, element.width, element.height, radius).fill({ color: failed ? 0xf1f2f4 : 0xe5e7eb }).stroke({ color: 0xd1d5db, width: 1 }));
      if (failed) root.addChild(drawBrokenImageIcon(element.width, element.height));
    }
    if (loading) {
      const width = Math.max(44, Math.min(140, element.width - 24));
      const x = (element.width - width) / 2;
      const y = element.height / 2 - 5;
      root.addChild(new Graphics().roundRect(x, y, width, 10, 999).fill({ color: detailSelectionColor, alpha: 0.16 }).roundRect(x, y, width * 0.58, 10, 999).fill({ color: detailSelectionColor, alpha: 0.82 }));
    }
    root.alpha = element.opacity ?? 1;
    target.addChild(root);
  }

  private drawImageSizeLabel(target: Graphics, element: Extract<CanvasElement, { type: "image" }>, bounds: Rectangle, center: Point, rotation: number, chromeScale: number) {
    const label = new Container();
    const text = new Text({ text: `${Math.round(element.width)} × ${Math.round(element.height)} px`, style: { fill: 0xffffff, fontFamily: "Inter Variable, Inter, system-ui, sans-serif", fontSize: 11, fontWeight: "600" } });
    label.scale.set(chromeScale);
    text.anchor.set(0.5);
    const width = text.width + 14;
    const y = bounds.height / (2 * chromeScale) + 18;
    label.addChild(new Graphics().roundRect(-width / 2, y - 11, width, 22, 5).fill({ color: 0x18181b, alpha: 0.92 }));
    text.position.set(0, y);
    label.addChild(text);
    label.position.set(center.x, center.y);
    label.rotation = rotation;
    target.addChild(label);
  }
}
export function distanceToSegment(
  point: Point,
  start: Point,
  end: Point,
): number {
  const dx =
    end.x - start.x;

  const dy =
    end.y - start.y;

  const lengthSquared =
    dx * dx +
    dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(
      point.x - start.x,
      point.y - start.y,
    );
  }

  const t =
    Math.max(
      0,
      Math.min(
        1,
        (
          (point.x - start.x) *
          dx +
          (point.y - start.y) *
          dy
        ) /
        lengthSquared,
      ),
    );

  const closestX =
    start.x +
    t * dx;

  const closestY =
    start.y +
    t * dy;

  return Math.hypot(
    point.x - closestX,
    point.y - closestY,
  );
}
