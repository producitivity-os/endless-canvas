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
  CardTemplateProvider,
  CanvasPluginCardProvider,
} from "../model";
import type { CanvasRenderContext, ElementRenderer } from "./renderers/renderer";
import { OverlayRenderer } from "./renderers/overlay-renderer";
import { RetainedViewLayer } from "./renderers/retained-view-layer";
import { markdownTextRenderer } from "../markdown";
import { CardPreviewCache } from "./renderers/card-preview-cache";
import { VideoRenderer } from "./renderers/video-renderer";
import { orderedCanvasLayers, visibleCanvasObjects, type CanvasLayer } from "../model";
import { normalizeInteractionColor } from "../model/layers";
import type { CanvasObjectExtension } from "../types/extensions.ts";
import { PermanentConnectionHandleRenderer } from "./renderers/permanent-connection-handle-renderer.ts";

interface RenderLayer {
  root: Container;
  under: Container;
  objects: Container;
  over: Container;
  objectViews: RetainedViewLayer<CanvasObject>;
  underArrowViews: RetainedViewLayer<ArrowObject>;
  overArrowViews: RetainedViewLayer<ArrowObject>;
}

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
  readonly canvasLayers = new Container();
  readonly previewLayer = new Graphics();
  readonly overlayLayer = new Container();
  private readonly renderers = new ElementRendererRegistry();
  private readonly arrowRenderer = new ArrowRenderer();
  private readonly videoRenderer = new VideoRenderer();
  private readonly overlayRenderer: OverlayRenderer;
  private readonly permanentConnectionHandles: PermanentConnectionHandleRenderer;
  private readonly objectBodies = new WeakMap<Container, Container>();
  private readonly layerViews = new Map<string, RenderLayer>();
  private cardPreviews: CardPreviewCache | null = null;
  detailViewport: Container | null = null;
  detailGrid: Graphics | null = null;
  private initialized = false;
  private destroyed = false;

  private readonly extensions: readonly CanvasObjectExtension<any>[];
  private readonly cardTemplates?: CardTemplateProvider;
  private readonly pluginCards?: CanvasPluginCardProvider;
  private readonly gridStyle: CanvasGridStyle;

  constructor(
    extensions: readonly CanvasObjectExtension<any>[] = [],
    cardTemplates?: CardTemplateProvider,
    pluginCards?: CanvasPluginCardProvider,
    gridStyle: CanvasGridStyle = "lines",
  ) {
    this.extensions = extensions;
    this.cardTemplates = cardTemplates;
    this.pluginCards = pluginCards;
    this.gridStyle = gridStyle;
    this.overlayRenderer = new OverlayRenderer(extensions, pluginCards);
    this.permanentConnectionHandles = new PermanentConnectionHandleRenderer(extensions);
  }

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
    this.renderers.register(
      "card",
      new CardRenderer(this.cardPreviews, this.cardTemplates, this.pluginCards),
    );
    const shapeRenderer = new ShapeRenderer();
    this.renderers.register("rect", shapeRenderer);
    this.renderers.register("ellipse", shapeRenderer);
    this.renderers.register("diamond", shapeRenderer);
    this.renderers.register("pentagon", shapeRenderer);
    this.renderers.register("parallelogram", shapeRenderer);
    this.renderers.register("image", new ImageRenderer());
    this.renderers.register("text", new TextRenderer());
    this.renderers.register("video", this.videoRenderer);
    this.renderers.register("path", new PathRenderer());
    for (const extension of this.extensions) {
      const renderer = extension.createRenderer?.();
      if (renderer) this.renderers.register(extension.type, renderer);
    }

    this.canvas.className = "pixi-canvas";
    this.canvas.tabIndex = 0;
    this.canvas.style.visibility = "hidden";
    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = this.app.screen;
    this.viewport.sortableChildren = true;
    this.canvasLayers.zIndex = 20;
    this.canvasLayers.sortableChildren = true;
    this.previewLayer.zIndex = 30;
    this.overlayLayer.zIndex = 40;

    this.app.stage.addChild(this.gridLayer, this.viewport);
    this.viewport.addChild(this.canvasLayers, this.previewLayer, this.overlayLayer);

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
    for (const layer of this.layerViews.values()) {
      layer.underArrowViews.clear();
      layer.objectViews.clear();
      layer.overArrowViews.clear();
      layer.root.destroy({ children: true });
    }
    this.layerViews.clear();
    this.previewLayer.clear();
    this.clearContainer(this.overlayLayer);
  }

  resize(): void {
    if (!this.initialized || this.destroyed) return;
    this.app.resize();
    this.app.stage.hitArea = this.app.screen;
  }

  destroy(): void {
    if (!this.initialized || this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.clearBoard();
    this.videoRenderer.destroy();
    this.cardPreviews?.destroy();
    this.cardPreviews = null;
    this.app.destroy(
      { removeView: true, releaseGlobalResources: false },
      {
        children: true,
      },
    );

    this.initialized = false;
  }

  render(
    state: EndlessCanvasState,
    runtime: EndlessCanvasRuntimeState,
    documentObjects: readonly CanvasObject[] = state.objects,
  ): void {
    if (!this.initialized || this.destroyed) return;
    this.cardPreviews?.prune([...documentObjects, ...state.objects]);
    this.drawGrid(this.app.screen.width, this.app.screen.height, 32, this.gridStyle);

    this.reconcileLayers(orderedCanvasLayers(state), state, runtime);

    markdownTextRenderer.prune(this.collectMarkdownIds([...documentObjects, ...state.objects]));

    this.previewLayer.clear();
    this.clearContainer(this.overlayLayer);
    this.overlayRenderer.render(
      this.overlayLayer,
      { ...state, objects: visibleCanvasObjects(state) },
      runtime,
      this.viewport.scale.x,
    );
  }

  invalidateCardPreview(cardId: string): void {
    this.cardPreviews?.invalidate(cardId);
  }

  get cardPreviewGenerationCount(): number {
    return this.cardPreviews?.generationCount() ?? 0;
  }

  private reconcileLayers(
    layers: readonly CanvasLayer[],
    state: EndlessCanvasState,
    runtime: EndlessCanvasRuntimeState,
  ): void {
    const valid = new Set(layers.map((layer) => layer.id));
    for (const [id, view] of this.layerViews) {
      if (valid.has(id)) continue;
      view.underArrowViews.clear();
      view.objectViews.clear();
      view.overArrowViews.clear();
      view.root.destroy({ children: true });
      this.layerViews.delete(id);
    }

    for (const layer of layers) {
      const view = this.layerView(layer.id);
      view.root.zIndex = layer.zIndex;
      view.root.visible = layer.visible;
      view.root.alpha =
        layer.opacity *
        (state.focusedLayerId && state.focusedLayerId !== layer.id
          ? (state.unfocusedLayerOpacity ?? 0.24)
          : 1);

      const layerObjects = state.objects.filter((object) => object.layerId === layer.id);
      this.renderArrows(
        view,
        layerObjects,
        state.objects,
        runtime,
        "under",
        layer.interactionColor,
      );
      view.objectViews.reconcile(
        view.objects,
        layerObjects.filter((object) => object.type !== "arrow"),
        (object) => object.id,
        (target, object) => {
          let body = this.objectBodies.get(target);
          if (!body) {
            body = new Container();
            this.objectBodies.set(target, body);
            target.addChild(body);
          }
          this.renderers.reconcile(body, object, {
            scale: this.viewport.scale.x,
            hovered: runtime.hoveredObjectId === object.id,
            hoveredRegionId:
              runtime.hoveredInteractionObjectId === object.id
                ? (runtime.hoveredInteractionRegionId ?? undefined)
                : undefined,
            selected: runtime.selection.isSelected(object.id),
            interactionColor: normalizeInteractionColor(layer.interactionColor),
            editing: runtime.editingTextId === object.id,
            imageCrop: runtime.imageCrop?.imageId === object.id ? runtime.imageCrop : undefined,
          });
          this.permanentConnectionHandles.render(
            target,
            object,
            runtime,
            this.viewport.scale.x,
            normalizeInteractionColor(layer.interactionColor),
          );
        },
      );
      this.renderArrows(view, layerObjects, state.objects, runtime, "over", layer.interactionColor);
    }
  }

  private renderArrows(
    view: RenderLayer,
    layerObjects: readonly CanvasObject[],
    documentObjects: readonly CanvasObject[],
    runtime: EndlessCanvasRuntimeState,
    mode: "under" | "over",
    interactionColor?: number,
  ): void {
    const arrows = layerObjects.filter((object): object is ArrowObject => {
      if (object.type !== "arrow") return false;
      const arrow = object as ArrowObject;
      return (arrow.renderMode === "under" ? "under" : "over") === mode;
    });
    const views = mode === "under" ? view.underArrowViews : view.overArrowViews;
    const target = mode === "under" ? view.under : view.over;
    views.reconcile(
      target,
      arrows,
      (arrow) => arrow.id,
      (view, arrow) => {
        this.clearContainer(view);
        this.arrowRenderer.render(view, arrow, documentObjects, {
          scale: this.viewport.scale.x,
          hovered: runtime.hoveredObjectId === arrow.id,
          hoveredRegionId:
            runtime.hoveredInteractionObjectId === arrow.id
              ? (runtime.hoveredInteractionRegionId ?? undefined)
              : undefined,
          selected: runtime.selection.isSelected(arrow.id),
          interactionColor: normalizeInteractionColor(interactionColor),
        });
      },
    );
  }

  private layerView(id: string): RenderLayer {
    const existing = this.layerViews.get(id);
    if (existing) return existing;
    const root = new Container();
    const under = new Container();
    const objects = new Container();
    const over = new Container();
    root.sortableChildren = true;
    under.zIndex = 0;
    objects.zIndex = 1;
    over.zIndex = 2;
    root.addChild(under, objects, over);
    this.canvasLayers.addChild(root);
    const created: RenderLayer = {
      root,
      under,
      objects,
      over,
      objectViews: new RetainedViewLayer<CanvasObject>((container, object) => {
        this.renderers.dispose(this.objectBodies.get(container) ?? container, object);
        this.permanentConnectionHandles.dispose(container);
        this.objectBodies.delete(container);
      }),
      underArrowViews: new RetainedViewLayer<ArrowObject>(),
      overArrowViews: new RetainedViewLayer<ArrowObject>(),
    };
    this.layerViews.set(id, created);
    return created;
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

    const color = theme === "dark" ? 0x505664 : 0xcbd2dc;

    if (style === "dots") {
      // A half-step horizontal shear produces the familiar 30-degree
      // isometric lattice while preserving the canvas' world-space origin.
      const rowStep = (step * Math.sqrt(3)) / 2;
      const firstRow = Math.floor(-viewport.y / rowStep) - 1;
      const lastRow = Math.ceil((height - viewport.y) / rowStep) + 1;
      for (let row = firstRow; row <= lastRow; row += 1) {
        const y = viewport.y + row * rowStep;
        const skewedOrigin = viewport.x + (row * step) / 2;
        const firstX = ((skewedOrigin % step) + step) % step;
        for (let x = firstX; x < width; x += step) {
          grid.circle(x, y, 1.5).fill({
            color,
            alpha: Math.max(opacity * 0.72, 0.52),
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
