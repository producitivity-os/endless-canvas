import { Container, Graphics, Rectangle, Sprite, Text } from "pixi.js";
import type { EditState, ResizeCorner } from "../types/events";
import type { Point } from "../types/geometry";
import type { CanvasElement } from "../types/elements";
import { drawTextElement } from "../model/text";
import type { CanvasGridStyle, CanvasTheme } from "../model/canvas";
import { drawBrokenImageIcon, imageIsLoading, imageLoadFailed, imageTextureFor } from "../model/image";
import { hasLatexCompileError, latexRenderedSize, latexTextureFor } from "../latex/latex";
import { detailSelectionColor, elementBounds, elementCenter, resizeHandleCenters } from "./utils";

// Owns pixi.js, responsible for rendering canvas elements in pixi.js graphics instance
export class CanvasEngine {
  // draws canvas elements
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

  // draws selection frame
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

  // draws grid
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

  //Private methods
  // draws shape
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

  // draws image
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

  // draws image size label
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
