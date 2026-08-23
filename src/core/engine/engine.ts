import { Application, Container, Graphics } from "pixi.js";
import type { CanvasGridStyle, CanvasTheme } from "../model/canvas";
import { CardRenderer } from "./renderers/card-renderer";
import { ImageRenderer } from "./renderers/image-render";
import { ShapeRenderer } from "./renderers/shape-renderer";
import { TextRenderer } from "./renderers/text-renderer";
import { PathRenderer } from "./renderers/path-renderer";
import { ArrowRenderer } from "./renderers/arrow-renderer";
import type { EndlessCanvasRuntimeState, EndlessCanvasState } from "../types";
import type {
  ArrowObject,
  CanvasCardObject,
  CanvasObject,
  CanvasObjectType,
  TextObject,
} from "../model";
import type { CanvasRenderContext, ElementRenderer } from "./renderers/renderer";
import { OverlayRenderer } from "./renderers/overlay-renderer";
import { RetainedViewLayer } from "./renderers/retained-view-layer";
import { markdownTextRenderer } from "../markdown";
import { CardPreviewCache } from "./renderers/card-preview-cache";

export class ElementRendererRegistry {
  private readonly renderers = new Map<CanvasObjectType, ElementRenderer<CanvasObject>>();
  private readonly keys = new WeakMap<Container, string>();

  register<T extends CanvasObject>(type: CanvasObjectType, renderer: ElementRenderer<T>): void {
    this.renderers.set(type, renderer as ElementRenderer<CanvasObject>);
  }
  render(target: Container, element: CanvasObject, context: CanvasRenderContext): void {
    const renderer = this.renderers.get(element.type);

    if (!renderer) {
      throw new Error(`No renderer registered for element type "${element.type}"`);
    }
    renderer.render(target, element, context);
  }

  reconcile(target: Container, element: CanvasObject, context: CanvasRenderContext): void {
    const renderer = this.rendererFor(element);
    if (renderer.reconcile) {
      renderer.reconcile(target, element, context);
      return;
    }
    const key = renderer.invalidationKey?.(element, context) ?? JSON.stringify([element, context]);
    if (this.keys.get(target) === key) return;
    this.clear(target);
    renderer.render(target, element, context);
    this.keys.set(target, key);
  }

  dispose(target: Container, element: CanvasObject): void {
    this.rendererFor(element).dispose?.(target, element.id);
    this.keys.delete(target);
  }

  private rendererFor(element: CanvasObject): ElementRenderer<CanvasObject> {
    const renderer = this.renderers.get(element.type);
    if (!renderer) {
      throw new Error(`No renderer registered for element type "${element.type}"`);
    }
    return renderer;
  }

  private clear(container: Container): void {
    for (const child of container.removeChildren()) child.destroy({ children: true });
  }
}

export class CanvasEngine {
  readonly app = new Application();

  readonly gridLayer = new Graphics();
  readonly viewport = new Container();
  readonly underArrowLayer = new Container();
  readonly objectLayer = new Container();
  readonly overArrowLayer = new Container();
  readonly previewLayer = new Graphics();
  readonly overlayLayer = new Container();
  private readonly renderers = new ElementRendererRegistry();
  private readonly arrowRenderer = new ArrowRenderer();
  private readonly overlayRenderer = new OverlayRenderer();
  private readonly objectViews = new RetainedViewLayer<CanvasObject>((container, object) =>
    this.renderers.dispose(container, object),
  );
  private readonly underArrowViews = new RetainedViewLayer<ArrowObject>();
  private readonly overArrowViews = new RetainedViewLayer<ArrowObject>();
  private cardPreviews: CardPreviewCache | null = null;
  detailViewport: Container | null = null;
  detailGrid: Graphics | null = null;
  private initialized = false;

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  async initialize(host: HTMLElement): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.app.init({
      antialias: true,
      autoDensity: true,
      background: "#f4f6f8",
      preference: "webgl",
      resizeTo: host,

      resolution: Math.min(2, window.devicePixelRatio || 1),
    });

    this.cardPreviews = new CardPreviewCache({
      generateTexture: (target, frame) =>
        this.app.renderer.generateTexture({
          target,
          frame,
          resolution: 1,
          clearColor: [0, 0, 0, 0],
          antialias: true,
        }),
      renderElement: (target, element, context) => this.renderers.render(target, element, context),
      renderArrow: (target, arrow, objects, context) =>
        this.arrowRenderer.render(target, arrow, objects, context),
    });
    this.renderers.register("card", new CardRenderer(this.cardPreviews));
    const shapeRenderer = new ShapeRenderer();
    this.renderers.register("rect", shapeRenderer);
    this.renderers.register("ellipse", shapeRenderer);
    this.renderers.register("diamond", shapeRenderer);
    this.renderers.register("pentagon", shapeRenderer);
    this.renderers.register("parallelogram", shapeRenderer);
    this.renderers.register("image", new ImageRenderer());
    this.renderers.register("text", new TextRenderer());
    this.renderers.register("path", new PathRenderer());

    this.canvas.className = "pixi-canvas";
    this.canvas.tabIndex = 0;
    this.canvas.style.visibility = "hidden";
    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = this.app.screen;
    this.viewport.sortableChildren = true;
    this.underArrowLayer.zIndex = 20;
    this.objectLayer.zIndex = 25;
    this.overArrowLayer.zIndex = 27;
    this.previewLayer.zIndex = 30;
    this.overlayLayer.zIndex = 40;

    this.app.stage.addChild(this.gridLayer, this.viewport);
    this.viewport.addChild(
      this.underArrowLayer,
      this.objectLayer,
      this.overArrowLayer,
      this.previewLayer,
      this.overlayLayer,
    );

    host.prepend(this.canvas);

    this.initialized = true;
  }

  focus(): void {
    this.canvas.focus();
  }

  setCursor(cursor: string): void {
    this.canvas.style.cursor = cursor;
  }

  clearCursor(): void {
    this.canvas.style.cursor = "";
  }

  clearPreview(): void {
    this.previewLayer.clear();
  }

  clearBoard(): void {
    this.underArrowViews.clear();
    this.objectViews.clear();
    this.overArrowViews.clear();
    this.previewLayer.clear();
    this.clearContainer(this.overlayLayer);
  }

  destroy(): void {
    if (!this.initialized) {
      return;
    }

    this.clearBoard();
    this.cardPreviews?.destroy();
    this.cardPreviews = null;
    markdownTextRenderer.destroy();
    this.app.destroy(true, {
      children: true,
    });

    this.initialized = false;
  }

  render(
    state: EndlessCanvasState,
    runtime: EndlessCanvasRuntimeState,
    documentObjects: readonly CanvasObject[] = state.objects,
  ): void {
    this.cardPreviews?.prune([...documentObjects, ...state.objects]);
    this.drawGrid(this.app.screen.width, this.app.screen.height);

    this.renderArrows(this.underArrowLayer, state, runtime, "under");

    const objects = state.objects.filter((object) => object.type !== "arrow");
    this.objectViews.reconcile(
      this.objectLayer,
      objects,
      (object) => object.id,
      (target, object) => {
        this.renderers.reconcile(target, object, {
          scale: this.viewport.scale.x,
          hovered: runtime.hoveredObjectId === object.id,
          selected: runtime.selection.isSelected(object.id),
          editing: runtime.editingTextId === object.id,
          imageCrop: runtime.imageCrop?.imageId === object.id ? runtime.imageCrop : undefined,
        });
      },
    );

    markdownTextRenderer.prune(this.collectMarkdownIds([...documentObjects, ...state.objects]));

    this.renderArrows(this.overArrowLayer, state, runtime, "over");

    this.previewLayer.clear();
    this.clearContainer(this.overlayLayer);
    this.overlayRenderer.render(this.overlayLayer, state, runtime, this.viewport.scale.x);
  }

  invalidateCardPreview(cardId: string): void {
    this.cardPreviews?.invalidate(cardId);
  }

  get cardPreviewGenerationCount(): number {
    return this.cardPreviews?.generationCount() ?? 0;
  }

  private renderArrows(
    target: Container,
    state: EndlessCanvasState,
    runtime: EndlessCanvasRuntimeState,
    layer: "under" | "over",
  ): void {
    const arrows = state.objects.filter((object): object is ArrowObject => {
      if (object.type !== "arrow") return false;
      const arrow = object as ArrowObject;
      return (arrow.renderMode === "under" ? "under" : "over") === layer;
    });
    const views = layer === "under" ? this.underArrowViews : this.overArrowViews;
    views.reconcile(
      target,
      arrows,
      (arrow) => arrow.id,
      (view, arrow) => {
        this.clearContainer(view);
        this.arrowRenderer.render(view, arrow, state.objects, {
          scale: this.viewport.scale.x,
          hovered: runtime.hoveredObjectId === arrow.id,
          selected: runtime.selection.isSelected(arrow.id),
        });
      },
    );
  }

  drawGrid(
    width: number,
    height: number,
    baseStep = 32,
    style: CanvasGridStyle = "lines",
    background = 0xf4f6f8,
    theme: CanvasTheme = "light",
    opacity = 0.72,
  ): void {
    const grid = this.gridLayer;
    const viewport = this.viewport;
    const step = baseStep * viewport.scale.x;
    const offsetX = ((viewport.x % step) + step) % step;
    const offsetY = ((viewport.y % step) + step) % step;

    grid.clear();
    grid.rect(0, 0, width, height).fill({
      color: background,
    });
    if (style === "none") {
      return;
    }

    const color = theme === "dark" ? 0x454a56 : 0xdfe4ec;

    if (style === "dots") {
      for (let x = offsetX; x < width; x += step) {
        for (let y = offsetY; y < height; y += step) {
          grid.circle(x, y, 1.25).fill({
            color,
            alpha: opacity,
          });
        }
      }
      return;
    }

    grid.setStrokeStyle({
      color,
      width: 1,
      alpha: opacity,
    });

    for (let x = offsetX; x < width; x += step) {
      grid.moveTo(x, 0).lineTo(x, height);
    }

    for (let y = offsetY; y < height; y += step) {
      grid.moveTo(0, y).lineTo(width, y);
    }

    grid.stroke();
  }
  show(): void {
    this.canvas.style.visibility = "visible";
  }

  private clearContainer(container: Container): void {
    for (const child of container.removeChildren()) {
      child.destroy({ children: true });
    }
  }

  private collectMarkdownIds(
    objects: readonly CanvasObject[],
    result = new Set<string>(),
  ): Set<string> {
    for (const object of objects) {
      if (object.type === "text" && (object as TextObject).format === "markdown") {
        result.add(object.id);
      } else if (object.type === "card") {
        this.collectMarkdownIds((object as CanvasCardObject).elements, result);
      }
    }
    return result;
  }
}
