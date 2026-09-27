import {
  canvasOverviewProjector,
  canvasVisualBounds,
  cardBorderGeometry,
  markdownCardLayout,
  shapeGeometry,
  type CanvasEngine,
  type CanvasOverviewSnapshot,
} from "../engine";
import { selectionHandles } from "../engine/renderers/selection-handles";
import {
  ArrowObject,
  ImageObject,
  TextObject,
  VideoObject,
  canvasObjectFactory,
  normalizeCanvasLayers,
  normalizeLayerOrder,
  uniqueCanvasLayerId,
  visibleCanvasObjects,
  type CanvasLayer,
  type CanvasObject,
  type CanvasObjectCapabilityDefaults,
  type CanvasPluginCardProvider,
  type CardTemplateProvider,
  type PluginCard,
  type TemplateCard,
  type TextFormat,
} from "../model";
import { arrowBindingResolver } from "../engine/arrows/arrow-binding-resolver";
import { textFontFamily } from "../model/text";
import { subscribeLatexRenderer } from "../latex";
import { markdownTextRenderer, markdownTypography } from "../markdown";
import {
  CanvasPropertyContextBuilder,
  CanvasPropertyDefaults,
  type CanvasPropertyDefaultsByTool,
  CanvasPropertyMutation,
  type CanvasPropertiesListener,
  type CanvasPropertyContext,
  type CanvasPropertyPatch,
} from "../properties";
import type {
  CanvasTool,
  CanvasImageCropRequest,
  EndlessCanvasRuntimeState,
  EndlessCanvasOptions,
  EndlessCanvasState,
  CanvasPoint,
  CanvasViewport,
  CanvasPaneChangeListener,
  CanvasPaneContext,
  CanvasConnectionDropHandler,
  CanvasSelectionChange,
  CanvasHistoryState,
  CanvasObjectExtension,
  CanvasObjectClickContext,
} from "../types";
import { canvasDrawnPlacement, type CanvasDrawnPlacement } from "../types";
import type {
  CanvasTextEditRequest,
  CanvasTextEditResult,
  KeyboardShortcutAction,
} from "../interaction";
import { CanvasTextMetrics } from "../interaction";
import type { CanvasDragEvent } from "./canvas-drag";
import { CanvasCreationSession, type CanvasCreationTool } from "./creation-session";
import { CanvasArrowInteraction, type ArrowEditHandle } from "./arrow-interaction";
import { CanvasMarqueeSelection } from "./marquee-selection";
import { CanvasObjectInteraction } from "./object-interaction";
import { CanvasSelectionState, type CanvasSelectionController } from "./selection";
import { CanvasSelectionMutation } from "./selection-mutation";
import { CanvasImageCropSession } from "./image-crop-session";
import { CanvasPaneController } from "./pane-navigation";
import type { CanvasCardObject } from "../model/card";
import { CanvasClipboard, SystemCanvasClipboard, type CanvasSystemClipboard } from "./clipboard";
import { videoPlaybackRegistry } from "../engine/renderers/video-renderer";
import { CanvasObjectCapabilityPolicy } from "./object-capability-policy";
import { CanvasObjectExtensionRegistry } from "./object-extension-registry.ts";
import { CanvasHistoryController } from "./history.ts";
import { CanvasOverviewPublisher } from "./canvas-overview-publisher.ts";
import { canvasViewportFitter, type CanvasViewportFitOptions } from "./canvas-viewport-fitter.ts";
import { canvasObjectPointerIsClick } from "./pointer-gesture.ts";

export type { CanvasDragEvent, CanvasDragEventType } from "./canvas-drag";

export interface CanvasImageSelection {
  dataUrl: string;
  name: string;
  width: number;
  height: number;
}

export interface CanvasContextTarget {
  kind: CanvasObject["type"] | "empty" | "multi";
  objectId: string | null;
  selectedIds: string[];
  mediaId?: string;
  cardKind?: CanvasCardObject["kind"];
  actions: readonly CanvasContextAction[];
}

export type CanvasContextAction =
  | "edit"
  | "fit"
  | "crop"
  | "toggle-playback"
  | "open-original"
  | "cut"
  | "copy"
  | "paste"
  | "delete";

export interface CanvasControllerOptions {
  engine: CanvasEngine;
  selection: CanvasSelectionController;
  state: EndlessCanvasState;
  runtime: EndlessCanvasRuntimeState;
  onChange?: () => void;
  onError?: (error: unknown) => void;
  requestText?: (request: CanvasTextEditRequest) => Promise<CanvasTextEditResult | null>;
  updateTextEditingLayout?: (
    layout: import("../interaction/inline-text-editor.ts").CanvasTextEditLayout,
  ) => void;
  cancelTextEditing?: () => void;
  commitTextEditing?: () => void;
  requestImage?: () => Promise<CanvasImageSelection | null>;
  requestVideo?: () => Promise<import("./asset").CanvasVideoSelection | null>;
  uploadImage?: (dataUrl: string, name: string) => Promise<{ url: string; name: string }>;
  onCropRequest?: (request: CanvasImageCropRequest) => void;
  defaultTextFormat?: TextFormat;
  onPropertiesChange?: CanvasPropertiesListener;
  maxPaneDepth?: number;
  onPaneChange?: CanvasPaneChangeListener;
  onViewportChange?: (viewport: CanvasViewport) => void;
  onOverviewChange?: (snapshot: CanvasOverviewSnapshot) => void;
  onToolRequest?: (tool: CanvasTool) => void;
  systemClipboard?: CanvasSystemClipboard;
  objectCapabilities?: CanvasObjectCapabilityDefaults;
  propertyDefaults?: CanvasPropertyDefaultsByTool;
  onConnectionDrop?: CanvasConnectionDropHandler;
  onAddToolPlacement?: (point: CanvasPoint) => CanvasObject | null;
  onAddToolDraw?: (placement: CanvasDrawnPlacement) => CanvasObject | null;
  onExternalImagePaste?: EndlessCanvasOptions["onExternalImagePaste"];
  resolveArrowDefaults?: EndlessCanvasOptions["resolveArrowDefaults"];
  onObjectActivate?: (object: CanvasObject) => void;
  onObjectClick?: (object: CanvasObject, context: CanvasObjectClickContext) => void;
  shouldEnterCardPane?: (card: CanvasCardObject) => boolean;
  canInsertObject?: (object: CanvasObject, pane: CanvasPaneContext) => boolean;
  onObjectCreate?: (object: CanvasObject, pane: CanvasPaneContext) => void;
  onObjectDelete?: (object: CanvasObject, pane: CanvasPaneContext) => void;
  onSelectionChange?: (selection: CanvasSelectionChange) => void;
  onHistoryChange?: (state: CanvasHistoryState) => void;
  objectExtensions?: readonly CanvasObjectExtension<any>[];
  cardTemplates?: CardTemplateProvider;
  pluginCards?: CanvasPluginCardProvider;
}

interface CanvasContentSnapshot {
  objects: CanvasObject[];
  layers?: CanvasLayer[];
  unfocusedLayerOpacity?: number;
}

export class CanvasController {
  private readonly options: CanvasControllerOptions;
  private readonly rootState: EndlessCanvasState;
  private readonly objectInteraction = new CanvasObjectInteraction();
  private readonly propertyDefaults: CanvasPropertyDefaults;
  private readonly propertyContextBuilder = new CanvasPropertyContextBuilder();
  private readonly propertyMutation = new CanvasPropertyMutation();
  private readonly propertyListeners = new Set<CanvasPropertiesListener>();
  private readonly creation: CanvasCreationSession;
  private readonly arrowInteraction: CanvasArrowInteraction;
  private readonly marquee = new CanvasMarqueeSelection();
  private readonly selectionMutation: CanvasSelectionMutation;
  private readonly panes: CanvasPaneController;
  private drag: CanvasDragEvent | null = null;
  private objectClickCandidate: {
    objectId: string;
    screenStart: CanvasPoint;
    objectStart: CanvasPoint;
  } | null = null;
  private imageCrop: CanvasImageCropSession | null = null;
  private imageRequestPending = false;
  private addToolDraw: { origin: CanvasPoint; current: CanvasPoint } | null = null;
  private dragMutated = false;
  private disposed = false;
  private latexRefitQueued = false;
  private propertiesSignature = "";
  private pointerScreenPoint: CanvasPoint | null = null;
  private readonly clipboard = new CanvasClipboard();
  private readonly systemClipboard: CanvasSystemClipboard;
  private readonly capabilityPolicy: CanvasObjectCapabilityPolicy;
  private readonly extensionRegistry: CanvasObjectExtensionRegistry;
  private readonly historyScopes: CanvasHistoryController<CanvasContentSnapshot>[] = [];
  private readonly overviewPublisher: CanvasOverviewPublisher;
  private readonly latexUnsubscribe: () => void;
  private selectionSignature = "";
  private pendingConnectionArrow: ArrowObject | null = null;
  private pointerInteraction: { objectId: string; regionId: string } | null = null;
  private activeTextLayout:
    (() => import("../interaction/inline-text-editor.ts").CanvasTextEditLayout) | null = null;

  constructor(options: CanvasControllerOptions) {
    normalizeCanvasLayers(options.state);
    this.rootState = options.state;
    this.systemClipboard = options.systemClipboard ?? new SystemCanvasClipboard();
    this.capabilityPolicy = new CanvasObjectCapabilityPolicy(options.objectCapabilities);
    this.extensionRegistry = new CanvasObjectExtensionRegistry(options.objectExtensions);
    for (const object of options.state.objects) this.capabilityPolicy.apply(object);
    this.normalizePermanentConnectionBindings(options.state.objects);
    this.options = {
      ...options,
      state: {
        objects: options.state.objects,
        layers: options.state.layers,
        activeLayerId: options.state.activeLayerId,
        focusedLayerId: options.state.focusedLayerId,
        unfocusedLayerOpacity: options.state.unfocusedLayerOpacity,
        viewport: options.state.viewport,
      },
    };
    this.syncTemplateCardDimensions(this.options.state.objects);
    this.propertyDefaults = new CanvasPropertyDefaults({
      ...options.propertyDefaults,
      text: {
        ...(options.propertyDefaults?.text ?? {}),
        format: options.defaultTextFormat ?? options.propertyDefaults?.text?.format ?? "plain",
      },
    });
    const viewport = options.state.viewport;
    if (
      viewport &&
      Number.isFinite(viewport.x) &&
      Number.isFinite(viewport.y) &&
      Number.isFinite(viewport.scale) &&
      viewport.scale > 0
    ) {
      options.engine.viewport.position.set(viewport.x, viewport.y);
      options.engine.viewport.scale.set(viewport.scale);
    }
    this.creation = new CanvasCreationSession(this.propertyDefaults);
    this.arrowInteraction = new CanvasArrowInteraction(this.propertyDefaults, (object, endpoint) =>
      this.connectionHintsFor(object, endpoint),
    );
    this.selectionMutation = new CanvasSelectionMutation(this.options.state, options.selection);
    this.panes = new CanvasPaneController({
      rootState: this.rootState,
      activeState: this.options.state,
      selection: options.selection,
      maxPaneDepth: options.maxPaneDepth,
      getViewport: () => ({
        x: options.engine.viewport.x,
        y: options.engine.viewport.y,
        scale: options.engine.viewport.scale.x,
      }),
      setViewport: (viewport) => {
        options.engine.viewport.position.set(viewport.x, viewport.y);
        options.engine.viewport.scale.set(viewport.scale);
        this.commitViewportChange();
      },
      centerViewport: (objects) => this.centerViewport(objects),
      onRootChange: options.onChange,
      onPaneChange: options.onPaneChange,
      onCardCommit: (card) => options.engine.invalidateCardPreview(card.id),
    });
    this.overviewPublisher = new CanvasOverviewPublisher(
      () => this.overviewSnapshot(),
      options.onOverviewChange,
    );
    this.historyScopes.push(this.createHistoryScope(true));
    this.notifyHistory();
    this.latexUnsubscribe = subscribeLatexRenderer(() => {
      markdownTextRenderer.invalidateResolvedLatex();
      this.scheduleMarkdownRefit();
    });
  }

  render(): void {
    if (!this.disposed) {
      if (this.activeTextLayout) this.options.updateTextEditingLayout?.(this.activeTextLayout());
      this.options.engine.render(this.options.state, this.options.runtime, this.rootState.objects);
      this.notifyProperties();
      this.overviewPublisher.schedule();
      this.notifySelection();
    }
  }

  renderForSnapshot(): void {
    if (this.disposed) return;
    const runtime: EndlessCanvasRuntimeState = {
      ...this.options.runtime,
      hoveredObjectId: null,
      hoveredInteractionObjectId: null,
      hoveredInteractionRegionId: null,
      creationPreview: null,
      arrowPreview: null,
      arrowHintObjectId: null,
      arrowHotHint: null,
      marquee: null,
      editingTextId: null,
      imageCrop: null,
      selection: new CanvasSelectionState(),
      tool: "select",
    };
    this.options.engine.render(this.options.state, runtime, this.rootState.objects);
  }

  focus(): void {
    this.options.engine.focus();
  }

  destroy(): void {
    this.disposed = true;
    this.overviewPublisher.destroy();
    this.latexUnsubscribe();
    this.options.cancelTextEditing?.();
    this.propertyListeners.clear();
  }

  paneContext(): CanvasPaneContext {
    return this.panes.context();
  }

  getPaneContext(): CanvasPaneContext {
    return this.paneContext();
  }

  getHistoryState(): CanvasHistoryState {
    return this.currentHistory().state;
  }

  undo(): boolean {
    if (this.hasActiveInteraction()) this.cancelActiveInteraction();
    const changed = this.currentHistory().undo();
    if (changed) this.afterHistoryRestore();
    return changed;
  }

  redo(): boolean {
    if (this.hasActiveInteraction()) this.cancelActiveInteraction();
    const changed = this.currentHistory().redo();
    if (changed) this.afterHistoryRestore();
    return changed;
  }

  beginHistoryTransaction(): void {
    this.currentHistory().begin();
  }

  commitHistoryTransaction(): boolean {
    const changed = this.currentHistory().commit();
    if (changed) {
      this.panes.markDirty();
      this.notifyHistory();
    }
    this.render();
    return changed;
  }

  cancelHistoryTransaction(): void {
    this.currentHistory().cancel();
    this.notifyHistory();
    this.render();
  }

  getLayers(): readonly CanvasLayer[] {
    return normalizeCanvasLayers(this.rootState);
  }

  getActiveLayerId(): string {
    normalizeCanvasLayers(this.rootState);
    return this.rootState.activeLayerId!;
  }

  getFocusedLayerId(): string | null {
    normalizeCanvasLayers(this.rootState);
    return this.rootState.focusedLayerId ?? null;
  }

  createLayer(name = "New layer", values: Partial<Omit<CanvasLayer, "id">> = {}): CanvasLayer {
    const layers = normalizeCanvasLayers(this.rootState);
    const layer: CanvasLayer = {
      id: uniqueCanvasLayerId(layers, name),
      name: name.trim() || `Layer ${layers.length + 1}`,
      zIndex: layers.length,
      visible: values.visible ?? true,
      opacity: this.clampOpacity(values.opacity),
      interactionColor: this.normalizeInteractionColor(values.interactionColor),
    };
    layers.push(layer);
    this.syncLayerState(layer.id, this.rootState.focusedLayerId ?? null);
    this.commitLayerChange();
    return { ...layer };
  }

  updateLayer(layerId: string, patch: Partial<Omit<CanvasLayer, "id">>): boolean {
    const layers = normalizeCanvasLayers(this.rootState);
    const layer = layers.find((candidate) => candidate.id === layerId);
    if (!layer) return false;
    if (patch.name !== undefined && patch.name.trim()) layer.name = patch.name.trim();
    if (patch.visible !== undefined) layer.visible = patch.visible;
    if (patch.opacity !== undefined) layer.opacity = this.clampOpacity(patch.opacity);
    if (patch.interactionColor !== undefined) {
      layer.interactionColor = this.normalizeInteractionColor(patch.interactionColor);
    }
    if (patch.zIndex !== undefined) {
      const ordered = layers.slice().sort((a, b) => a.zIndex - b.zIndex);
      const from = ordered.findIndex((candidate) => candidate.id === layerId);
      const to = Math.max(0, Math.min(ordered.length - 1, Math.round(patch.zIndex)));
      ordered.splice(to, 0, ...ordered.splice(from, 1));
      ordered.forEach((candidate, index) => {
        candidate.zIndex = index;
      });
    }
    if (!layer.visible) this.clearSelectionForLayer(layerId);
    this.commitLayerChange();
    return true;
  }

  moveLayer(layerId: string, toIndex: number): boolean {
    const layers = normalizeCanvasLayers(this.rootState);
    const ordered = layers.slice().sort((a, b) => a.zIndex - b.zIndex);
    const from = ordered.findIndex((layer) => layer.id === layerId);
    if (from < 0) return false;
    const to = Math.max(0, Math.min(ordered.length - 1, Math.round(toIndex)));
    if (from === to) return false;
    ordered.splice(to, 0, ...ordered.splice(from, 1));
    ordered.forEach((layer, index) => {
      layer.zIndex = index;
    });
    normalizeLayerOrder(layers);
    this.commitLayerChange();
    return true;
  }

  deleteLayer(layerId: string): boolean {
    const layers = normalizeCanvasLayers(this.rootState);
    if (layers.length <= 1) return false;
    const index = layers.findIndex((layer) => layer.id === layerId);
    if (index < 0) return false;
    const deletedIds = new Set(
      this.rootState.objects
        .filter((object) => object.layerId === layerId)
        .map((object) => object.id),
    );
    for (const object of this.rootState.objects) {
      if (object.type !== "arrow" || deletedIds.has(object.id)) continue;
      const arrow = object as ArrowObject;
      for (const endpoint of [arrow.start, arrow.end]) {
        if (endpoint.binding && deletedIds.has(endpoint.binding.objectId)) {
          endpoint.point = arrowBindingResolver.resolve(endpoint, this.rootState.objects);
          endpoint.binding = undefined;
        }
      }
      arrow.updateBounds();
    }
    this.rootState.objects = this.rootState.objects.filter((object) => object.layerId !== layerId);
    if (this.panes.context().stackLevel === 0) this.options.state.objects = this.rootState.objects;
    layers.splice(index, 1);
    normalizeLayerOrder(layers);
    const fallback = layers[Math.min(index, layers.length - 1)].id;
    this.syncLayerState(
      this.rootState.activeLayerId === layerId ? fallback : this.rootState.activeLayerId!,
      this.rootState.focusedLayerId === layerId ? null : (this.rootState.focusedLayerId ?? null),
    );
    this.options.selection.clear();
    this.commitLayerChange();
    return true;
  }

  setActiveLayer(layerId: string): boolean {
    if (!normalizeCanvasLayers(this.rootState).some((layer) => layer.id === layerId)) return false;
    this.syncLayerState(layerId, this.rootState.focusedLayerId ?? null);
    this.commitLayerNavigationChange();
    return true;
  }

  setFocusedLayer(layerId: string | null): boolean {
    if (layerId && !normalizeCanvasLayers(this.rootState).some((layer) => layer.id === layerId)) {
      return false;
    }
    this.syncLayerState(this.rootState.activeLayerId!, layerId);
    this.commitLayerNavigationChange();
    return true;
  }

  setUnfocusedLayerOpacity(opacity: number): void {
    this.rootState.unfocusedLayerOpacity = this.clampOpacity(opacity, 0.24);
    this.options.state.unfocusedLayerOpacity = this.rootState.unfocusedLayerOpacity;
    this.commitLayerChange();
  }

  subscribePaneChange(listener: CanvasPaneChangeListener): () => void {
    return this.panes.subscribe(listener);
  }

  enterCard(cardOrId: CanvasCardObject | string): boolean {
    if (this.hasActiveInteraction()) this.cancelActiveInteraction();
    const entered = this.panes.enter(cardOrId);
    if (!entered) return false;
    this.historyScopes.push(this.createHistoryScope(false));
    this.notifyHistory();
    this.options.runtime.hoveredObjectId = null;
    this.options.runtime.hoveredInteractionObjectId = null;
    this.options.runtime.hoveredInteractionRegionId = null;
    this.render();
    return true;
  }

  enterCardPane(cardOrId: CanvasCardObject | string): boolean {
    return this.enterCard(cardOrId);
  }

  commitAndExitPane(): boolean {
    if (this.hasActiveInteraction()) this.cancelActiveInteraction();
    const exited = this.panes.commitAndExit();
    if (!exited) return false;
    this.historyScopes.pop();
    this.currentHistory().record();
    this.notifyHistory();
    this.options.runtime.hoveredObjectId = null;
    this.options.runtime.hoveredInteractionObjectId = null;
    this.options.runtime.hoveredInteractionRegionId = null;
    this.render();
    return true;
  }

  exitPane(): boolean {
    return this.commitAndExitPane();
  }

  fitCardToContent(cardOrId: CanvasCardObject | string): boolean {
    const candidate = typeof cardOrId === "string" ? this.getObject(cardOrId) : cardOrId;
    if (candidate?.type === "card" && (candidate as CanvasCardObject).kind === "template") {
      return false;
    }
    if (
      candidate?.type === "card" &&
      (candidate as CanvasCardObject).kind === "markdown" &&
      this.options.state.objects.includes(candidate)
    ) {
      const changed = this.fitMarkdownCardToContent(candidate as CanvasCardObject);
      if (!changed) return false;
      this.emitChange();
      this.render();
      return true;
    }
    const changed = this.panes.fit(cardOrId);
    if (changed) {
      this.currentHistory().record();
      this.notifyHistory();
      this.render();
    }
    return changed;
  }

  fitObjectToContent(objectId: string): boolean {
    const object = this.getObject(objectId);
    if (!object) return false;
    if (object.type === "card") return this.fitCardToContent(object as CanvasCardObject);
    if (object.type !== "text") return false;
    const text = object as TextObject;
    const previousMinimum = text.minHeight;
    text.minHeight = 1;
    const metrics = new CanvasTextMetrics();
    const size =
      text.format === "markdown"
        ? markdownTextRenderer.measure(text, true)
        : text.sizing === "fixed"
          ? metrics.measureFixed(text.text, this.textEditorStyle(text), text.width)
          : metrics.measure(text.text, this.textEditorStyle(text));
    text.minHeight = previousMinimum;
    const width = text.format === "markdown" || text.sizing === "auto" ? size.width : text.width;
    const height = size.height;
    if (Math.abs(text.width - width) < 0.5 && Math.abs(text.height - height) < 0.5) return false;
    text.width = width;
    text.height = height;
    text.minHeight = height;
    this.emitChange();
    this.render();
    return true;
  }

  private textEditorStyle(text: TextObject) {
    return {
      fontFamily: textFontFamily(text.fontFamily),
      fontSize: text.fontSize,
      fontWeight: text.fontWeight(),
      italic: text.italic,
      color: this.colorToCss(text.color),
      opacity: text.opacity,
      lineHeight: text.lineHeight,
      letterSpacing: text.letterSpacing,
      padding: text.padding,
      textAlign: text.textAlign,
    };
  }

  private fitMarkdownCardToContent(card: CanvasCardObject): boolean {
    const measurement = new TextObject({
      id: `${card.id}::markdown-fit`,
      type: "text",
      x: 0,
      y: 0,
      width: markdownCardLayout.contentWidth(card.width),
      height: 1,
      text: card.markdown,
      format: "markdown",
      sizing: "fixed",
      minHeight: 1,
      fontSize: 16,
      lineHeight: markdownTypography.lineHeight,
      color: 0x1f2530,
      padding: 0,
    });
    const size = markdownTextRenderer.measure(measurement);
    markdownTextRenderer.dispose(measurement.id);
    const height = markdownCardLayout.cardHeight(size.height);
    if (Math.abs(card.height - height) < 0.5) return false;
    card.height = height;
    return true;
  }

  propertyContext(): CanvasPropertyContext {
    return this.propertyContextBuilder.build(
      this.options.runtime.tool,
      this.options.state.objects,
      this.options.selection.objects,
      this.propertyDefaults,
    );
  }

  subscribeProperties(listener: CanvasPropertiesListener): () => void {
    this.propertyListeners.add(listener);
    listener(this.propertyContext());
    return () => this.propertyListeners.delete(listener);
  }

  applyPropertyPatch(patch: CanvasPropertyPatch): number {
    const selected = this.options.state.objects.filter((object) =>
      this.options.selection.isSelected(object.id),
    );
    if (selected.length === 0) {
      const changes = this.propertyDefaults.apply(this.options.runtime.tool, patch);
      if (changes > 0) this.render();
      return changes;
    }

    const changes = this.propertyMutation.apply(selected, patch);
    if (changes === 0) return 0;
    for (const object of selected) {
      if (object.type !== "text") continue;
      const text = object as TextObject;
      if (patch.format !== undefined) {
        markdownTextRenderer.invalidate(text.id);
        if (text.format === "markdown") {
          text.sourceWidth ??= text.width;
          text.sourceHeight ??= text.height;
        }
      }
      else markdownTextRenderer.invalidateMeasurement(text.id);
      let size: { width: number; height: number };
      if (text.format === "markdown") {
        size = markdownTextRenderer.measure(text, true);
      } else {
        markdownTextRenderer.dispose(text.id);
        const metrics = new CanvasTextMetrics();
        size =
          text.sizing === "fixed"
            ? metrics.measureFixed(text.text, this.textEditorStyle(text), text.width)
            : metrics.measure(text.text, this.textEditorStyle(text));
      }
      if (text.format === "markdown") {
        text.width = size.width;
        text.height = size.height;
      } else {
        text.width = Math.max(text.width, size.width);
        text.height = Math.max(text.height, text.minHeight, size.height);
      }
    }
    this.emitChange();
    this.render();
    return changes;
  }

  pointerDown(point: CanvasPoint, event: PointerEvent): void {
    this.pointerScreenPoint = { ...point };
    if (this.pendingConnectionArrow) return;
    if (event.button !== 0) {
      return;
    }
    if (this.options.runtime.editingTextId) {
      this.options.commitTextEditing?.();
      return;
    }

    const worldPoint = this.screenToWorld(point);
    const tool = this.options.runtime.tool;
    if (tool === "select" || tool === "mouse") {
      // Object-local controls can overlap fixed-size connection handles when
      // zoomed out. Prefer the visible control everywhere inside its region;
      // the endpoint itself remains available outside that region.
      const pointerRegion = this.extensionRegistry.hitPointerInteractionRegion(
        this.interactionObjects(),
        worldPoint,
      );
      const connection = pointerRegion ? null : this.hitPermanentConnectionHandle(worldPoint);
      if (connection) {
        this.arrowInteraction.beginCreation(
          "arrow",
          connection.point,
          this.interactionObjects(),
          this.viewportScale,
          {
            point: { ...connection.point },
            binding: {
              objectId: connection.object.id,
              anchor: { ...connection.anchor },
              hint: connection.hint,
            },
          },
          this.options.resolveArrowDefaults?.("arrow", this.panes.context()),
        );
        this.options.runtime.arrowPreview = this.arrowInteraction.preview();
        this.options.engine.setCursor("crosshair");
        this.render();
        return;
      }
    }
    if (this.imageCrop) {
      const cursor = this.imageCrop.cursorAt(worldPoint, this.viewportScale);
      if (this.imageCrop.beginDrag(worldPoint, this.viewportScale)) {
        this.options.engine.setCursor(cursor);
        return;
      }
      if (this.imageCrop.containsSource(worldPoint)) {
        return;
      }
      this.commitImageCrop();
    }
    if (tool === "arrow" || tool === "line") {
      this.arrowInteraction.beginCreation(
        tool,
        worldPoint,
        this.interactionObjects(),
        this.viewportScale,
        undefined,
        this.options.resolveArrowDefaults?.(tool, this.panes.context()),
      );
      this.options.runtime.arrowPreview = this.arrowInteraction.preview();
      this.options.selection.clear();
      this.render();
      return;
    }

    if (this.isCreationTool(tool)) {
      this.beginCreation(tool, worldPoint);
      return;
    }

    switch (tool) {
      case "hand":
        this.beginPan(point);
        return;
      case "select":
      case "mouse":
        this.beginSelection(worldPoint, event);
        return;
      case "image":
        this.beginImageInsert(worldPoint);
        return;
      case "video":
        this.beginVideoInsert(worldPoint);
        return;
      case "add":
        if (this.options.onAddToolDraw) {
          this.addToolDraw = {
            origin: { ...worldPoint },
            current: { ...worldPoint },
          };
          this.options.runtime.creationPreview = {
            type: "box",
            tool: "add",
            origin: { ...worldPoint },
            current: { ...worldPoint },
          };
          this.options.selection.clear();
          this.options.engine.setCursor("crosshair");
          this.render();
          return;
        }
        this.placeAddToolObject(worldPoint);
        return;
    }
  }

  pointerMove(point: CanvasPoint, event: PointerEvent): void {
    this.pointerScreenPoint = { ...point };
    if (this.pendingConnectionArrow) return;
    if (this.pointerInteraction) {
      const activeObject = this.options.state.objects.find(
        (object) => object.id === this.pointerInteraction?.objectId,
      );
      if (activeObject) {
        const mutated = this.extensionRegistry.activatePointerGesture(
          activeObject,
          this.pointerInteraction.regionId,
          "move",
          this.screenToWorld(point),
          this.options.state.objects,
        );
        if (mutated) this.emitChange();
      }
      const hit = this.extensionRegistry.hitPointerInteractionRegion(
        this.interactionObjects(),
        this.screenToWorld(point),
      );
      const active =
        hit?.object.id === this.pointerInteraction.objectId &&
        hit.region.id === this.pointerInteraction.regionId;
      this.options.runtime.hoveredInteractionObjectId = active ? (hit?.object.id ?? null) : null;
      this.options.runtime.hoveredInteractionRegionId = active ? (hit?.region.id ?? null) : null;
      this.options.engine.setCursor(
        active ? (hit.region.cursor ?? "pointer") : this.cursorForTool(this.options.runtime.tool),
      );
      this.render();
      return;
    }
    if (this.imageCrop) {
      const worldPoint = this.screenToWorld(point);
      if (this.imageCrop.update(worldPoint, this.viewportScale)) {
        this.options.runtime.imageCrop = this.imageCrop.preview();
      }
      this.options.engine.setCursor(this.imageCrop.cursorAt(worldPoint, this.viewportScale));
      this.render();
      return;
    }
    if (this.addToolDraw) {
      this.addToolDraw.current = this.screenToWorld(point);
      this.options.runtime.creationPreview = {
        type: "box",
        tool: "add",
        origin: { ...this.addToolDraw.origin },
        current: { ...this.addToolDraw.current },
      };
      this.render();
      return;
    }
    if (this.creation.active) {
      this.creation.update(this.screenToWorld(point));
      this.options.runtime.creationPreview = this.creation.preview();
      this.render();
      return;
    }

    if (this.arrowInteraction.creating) {
      this.arrowInteraction.updateCreation(
        this.screenToWorld(point),
        this.interactionObjects(),
        this.viewportScale,
      );
      this.options.runtime.arrowPreview = this.arrowInteraction.preview();
      this.render();
      return;
    }

    if (this.arrowInteraction.editing) {
      this.arrowInteraction.updateEdit(
        this.screenToWorld(point),
        this.interactionObjects(),
        this.viewportScale,
      );
      const hint = this.arrowInteraction.hint();
      this.options.runtime.arrowHintObjectId = hint.objectId;
      this.options.runtime.arrowHotHint = hint.hotHint;
      this.render();
      return;
    }

    if (this.marquee.active) {
      this.marquee.update(
        this.screenToWorld(point),
        this.interactionObjects(),
        this.options.selection,
      );
      this.options.runtime.marquee = this.marquee.preview();
      this.render();
      return;
    }

    const drag = this.drag;
    if (!drag) {
      this.updateHover(this.screenToWorld(point));
      return;
    }

    switch (drag.type) {
      case "pan": {
        const dx = point.x - drag.pointerStart.x;
        const dy = point.y - drag.pointerStart.y;
        this.options.engine.viewport.x = drag.viewportStart.x + dx;
        this.options.engine.viewport.y = drag.viewportStart.y + dy;
        this.render();
        return;
      }
      case "object": {
        const worldPoint = this.screenToWorld(point);
        const object = this.getObject(drag.objectId);
        if (!object) {
          this.drag = null;
          return;
        }
        if (
          this.objectClickCandidate?.objectId === object.id &&
          !canvasObjectPointerIsClick(this.objectClickCandidate.screenStart, point)
        ) {
          this.objectClickCandidate = null;
        }
        const nextX = drag.objectStart.x + worldPoint.x - drag.pointerStart.x;
        const nextY = drag.objectStart.y + worldPoint.y - drag.pointerStart.y;
        const dx = nextX - object.x;
        const dy = nextY - object.y;
        if (dx !== 0 || dy !== 0) {
          object.translate(dx, dy);
          this.dragMutated = true;
        }
        this.render();
        return;
      }
      case "group-object": {
        const worldPoint = this.screenToWorld(point);
        const dx = worldPoint.x - drag.pointerPrevious.x;
        const dy = worldPoint.y - drag.pointerPrevious.y;
        if (dx !== 0 || dy !== 0) {
          for (const id of drag.objectIds) this.getObject(id)?.translate(dx, dy);
          drag.pointerPrevious = { ...worldPoint };
          this.dragMutated = true;
        }
        this.render();
        return;
      }
      case "resize-object": {
        const object = this.getObject(drag.objectId);
        if (!object) {
          this.drag = null;
          return;
        }
        const before = object.bounds();
        this.objectInteraction.resize(
          object,
          drag,
          this.screenToWorld(point),
          event.shiftKey,
          this.extensionRegistry.minimumSize(object),
        );
        this.dragMutated ||=
          before.x !== object.x ||
          before.y !== object.y ||
          before.width !== object.width ||
          before.height !== object.height;
        this.render();
        return;
      }
      case "rotate-object": {
        const object = this.getObject(drag.objectId);
        if (!object) {
          this.drag = null;
          return;
        }
        const before = object.rotation;
        this.objectInteraction.rotate(object, drag, this.screenToWorld(point), event.shiftKey);
        this.dragMutated ||= before !== object.rotation;
        this.render();
        return;
      }
      case "adjust-shape-parameter": {
        const object = this.getObject(drag.objectId);
        if (!object) {
          this.drag = null;
          return;
        }
        this.dragMutated ||= this.objectInteraction.adjustShapeParameter(
          object,
          drag,
          this.screenToWorld(point),
        );
        this.render();
        return;
      }
      case "draw-object":
        return;
    }
  }

  pointerUp(point: CanvasPoint, event: PointerEvent): void {
    this.pointerScreenPoint = { ...point };
    if (this.pendingConnectionArrow) return;
    if (this.pointerInteraction) {
      const interaction = this.pointerInteraction;
      this.pointerInteraction = null;
      const activeObject = this.options.state.objects.find(
        (object) => object.id === interaction.objectId,
      );
      if (activeObject) {
        const mutated = this.extensionRegistry.activatePointerGesture(
          activeObject,
          interaction.regionId,
          event.type === "pointercancel" ? "cancel" : "end",
          this.screenToWorld(point),
          this.options.state.objects,
        );
        if (mutated) this.emitChange();
      }
      const hit =
        event.type === "pointercancel"
          ? null
          : this.extensionRegistry.hitPointerInteractionRegion(
              this.interactionObjects(),
              this.screenToWorld(point),
            );
      const object =
        hit?.object.id === interaction.objectId && hit.region.id === interaction.regionId
          ? hit.object
          : null;
      if (
        object &&
        this.extensionRegistry.activatePointerInteraction(
          object,
          interaction.regionId,
          this.options.state.objects,
        )
      ) {
        this.enforceMinimumSize(object);
        this.emitChange();
      }
      this.options.engine.setCursor(this.cursorForTool(this.options.runtime.tool));
      this.render();
      return;
    }
    if (this.imageCrop) {
      this.imageCrop.endDrag();
      this.options.engine.setCursor(
        this.imageCrop.cursorAt(this.screenToWorld(point), this.viewportScale),
      );
      this.render();
      return;
    }
    if (this.addToolDraw) {
      const placement = canvasDrawnPlacement(this.addToolDraw.origin, this.screenToWorld(point));
      this.addToolDraw = null;
      this.options.runtime.creationPreview = null;
      if (event.type !== "pointercancel") {
        const object = this.options.onAddToolDraw?.(placement) ?? null;
        if (object && this.canInsert(object)) {
          this.assignActiveLayer(object);
          this.options.state.objects.push(object);
          this.notifyObjectCreate(object);
          this.options.selection.selectObject(object.id);
          this.emitChange();
        }
      }
      this.options.engine.setCursor(this.cursorForTool(this.options.runtime.tool));
      this.render();
      this.requestSelectTool();
      return;
    }
    if (this.creation.active) {
      const object = this.creation.finish();
      this.options.runtime.creationPreview = null;
      if (object?.type === "text") {
        this.assignActiveLayer(object);
        this.beginTextEditing(object as TextObject, false);
      } else if (object) {
        if (!this.canInsert(object)) {
          this.options.engine.setCursor(this.cursorForTool(this.options.runtime.tool));
          this.render();
          return;
        }
        this.assignActiveLayer(object);
        this.options.state.objects.push(object);
        this.notifyObjectCreate(object);
        this.options.selection.selectObject(object.id);
        this.emitChange();
      }
      this.options.engine.setCursor(this.cursorForTool(this.options.runtime.tool));
      this.render();
      if (object && object.type !== "text") this.requestSelectTool();
      return;
    }

    if (this.arrowInteraction.creating) {
      const arrow = this.arrowInteraction.finishCreation(this.interactionObjects());
      this.options.runtime.arrowPreview = null;
      this.options.runtime.arrowHintObjectId = null;
      this.options.runtime.arrowHotHint = null;
      if (arrow?.start.binding && !arrow.end.binding && this.options.onConnectionDrop) {
        void this.finishConnectionDrop(arrow, point);
        this.render();
        return;
      }
      if (arrow) {
        if (!this.canInsert(arrow)) {
          this.render();
          return;
        }
        this.assignActiveLayer(arrow);
        this.options.state.objects.push(arrow);
        this.notifyObjectCreate(arrow);
        this.options.selection.selectObject(arrow.id);
        this.emitChange();
      }
      this.render();
      if (arrow) this.requestSelectTool();
      return;
    }

    if (this.arrowInteraction.editing) {
      const mutated = this.arrowInteraction.finishEdit();
      this.options.runtime.arrowHintObjectId = null;
      this.options.runtime.arrowHotHint = null;
      if (mutated) this.emitChange();
      this.render();
      return;
    }

    if (this.marquee.active) {
      this.marquee.finish();
      this.options.runtime.marquee = null;
      this.render();
      return;
    }

    if (!this.drag) {
      return;
    }

    if (
      event.type !== "pointercancel" &&
      this.drag.type === "object" &&
      this.objectClickCandidate?.objectId === this.drag.objectId
    ) {
      const candidate = this.objectClickCandidate;
      const object = this.getObject(candidate.objectId);
      if (object) object.moveTo(candidate.objectStart);
      this.objectClickCandidate = null;
      this.drag = null;
      this.dragMutated = false;
      this.options.engine.setCursor(this.cursorForTool(this.options.runtime.tool));
      if (object) {
        const region = this.extensionRegistry.hitPointerInteractionRegion(
          this.interactionObjects(),
          this.screenToWorld(point),
        );
        this.options.onObjectClick?.(object, {
          regionId:
            region?.object.id === object.id && region.region.capture === false
              ? region.region.id
              : undefined,
        });
      }
      this.render();
      return;
    }

    this.objectClickCandidate = null;

    if (this.drag.type === "pan") {
      this.commitViewportChange();
    } else if (this.dragMutated) {
      this.emitChange();
    }
    this.drag = null;
    this.dragMutated = false;
    this.options.engine.setCursor(this.cursorForTool(this.options.runtime.tool));
    this.render();
  }

  pointerLeave(): void {
    this.pointerScreenPoint = null;
    if (!this.arrowInteraction.creating && !this.arrowInteraction.editing) {
      this.options.runtime.arrowHintObjectId = null;
      this.options.runtime.arrowHotHint = null;
      this.render();
    }
  }

  executeShortcut(action: KeyboardShortcutAction): void {
    switch (action) {
      case "delete-selection":
        this.deleteSelection();
        return;
      case "select-all":
        this.selectAll();
        return;
      case "copy-selection":
        void this.copySelection().catch((error) => this.options.onError?.(error));
        return;
      case "cut-selection":
        void this.cutSelection().catch((error) => this.options.onError?.(error));
        return;
      case "paste":
        void this.pasteClipboard().catch((error) => this.options.onError?.(error));
        return;
      case "undo":
        this.undo();
        return;
      case "redo":
        this.redo();
        return;
      case "cancel":
        this.cancelInteractions();
        if (this.options.runtime.tool !== "select" && this.options.runtime.tool !== "mouse") {
          this.options.onToolRequest?.("select");
        }
        return;
      case "commit-interaction":
        this.commitImageCrop();
    }
  }

  doubleClick(point: CanvasPoint): void {
    if (this.pendingConnectionArrow) return;
    if (this.imageCrop) {
      this.commitImageCrop();
      return;
    }
    if (this.options.runtime.tool !== "select" && this.options.runtime.tool !== "mouse") {
      return;
    }
    const object = this.objectInteraction.hitObject(
      this.interactionObjects(),
      this.screenToWorld(point),
    );
    if (object?.type === "card") {
      const card = object as CanvasCardObject;
      if (card.kind === "markdown") this.beginMarkdownCardEditing(card);
      else if (card.kind === "template" || card.kind === "revision" || card.kind === "plugin")
        this.options.onObjectActivate?.(card);
      else if (this.options.shouldEnterCardPane?.(card) ?? true) this.enterCard(card);
      else this.options.onObjectActivate?.(card);
    } else if (object?.type === "image") {
      this.beginImageCrop(object as ImageObject);
    } else if (object?.type === "text") {
      this.beginTextEditing(object as TextObject, true, point);
    } else if (object) {
      this.options.onObjectActivate?.(object);
    }
  }

  insertObject(object: CanvasObject, select = true): CanvasObject | null {
    if (!this.canInsert(object)) return null;
    this.capabilityPolicy.apply(object);
    this.enforceMinimumSize(object);
    if (!normalizeCanvasLayers(this.rootState).some((layer) => layer.id === object.layerId)) {
      this.assignActiveLayer(object);
    }
    this.options.state.objects.push(object);
    this.notifyObjectCreate(object);
    if (select) this.options.selection.selectObject(object.id);
    this.emitChange();
    this.render();
    return object;
  }

  removeObjects(objectIds: readonly string[]): number {
    const removedIds = new Set(objectIds);
    if (removedIds.size === 0) return 0;
    const removed = this.options.state.objects.filter((object) => removedIds.has(object.id));
    if (removed.length === 0) return 0;
    for (const object of this.options.state.objects) {
      if (object.type !== "arrow" || removedIds.has(object.id)) continue;
      const arrow = object as ArrowObject;
      for (const endpoint of [arrow.start, arrow.end]) {
        if (endpoint.binding && removedIds.has(endpoint.binding.objectId)) {
          endpoint.point = arrowBindingResolver.resolve(endpoint, this.options.state.objects);
          endpoint.binding = undefined;
        }
      }
      arrow.updateBounds();
    }
    const retained = this.options.state.objects.filter((object) => !removedIds.has(object.id));
    this.options.state.objects.splice(0, this.options.state.objects.length, ...retained);
    if (removed.some((object) => this.options.selection.isSelected(object.id)))
      this.options.selection.clear();
    this.emitChange();
    this.render();
    return removed.length;
  }

  focusObject(objectId: string): boolean {
    const object = this.getObject(objectId);
    if (!object) return false;
    this.options.selection.selectObject(object.id);
    this.centerViewport([object]);
    this.notifySelection();
    this.render();
    return true;
  }

  updateObject(objectId: string, patch: Partial<CanvasObject>): boolean {
    return this.updateObjects([{ objectId, patch }]) > 0;
  }

  updateObjects(updates: readonly { objectId: string; patch: Partial<CanvasObject> }[]): number {
    const updated = new Set<string>();
    for (const update of updates) {
      const object = this.getObject(update.objectId);
      if (!object) continue;
      const immutable = { id: object.id, type: object.type, layerId: object.layerId };
      Object.assign(object, update.patch, immutable);
      this.capabilityPolicy.apply(object);
      this.enforceMinimumSize(object);
      updated.add(object.id);
    }
    if (updated.size === 0) return 0;
    if (
      this.options.state.objects.some(
        (object) =>
          updated.has(object.id) && this.extensionRegistry.hasPermanentConnectionHandles(object),
      )
    ) {
      this.normalizePermanentConnectionBindings(this.options.state.objects);
    }
    this.emitChange();
    this.render();
    return updated.size;
  }

  deleteSelection(): boolean {
    if (this.imageCrop) {
      this.cancelImageCrop();
    }
    const pane = this.panes.context();
    const removed = this.options.state.objects.filter((object) =>
      this.options.selection.isSelected(object.id),
    );
    const mutated = this.selectionMutation.deleteSelection();
    if (!mutated) {
      return false;
    }
    this.options.runtime.hoveredObjectId = null;
    this.options.runtime.hoveredInteractionObjectId = null;
    this.options.runtime.hoveredInteractionRegionId = null;
    for (const object of removed) this.options.onObjectDelete?.(object, pane);
    this.emitChange();
    this.render();
    return true;
  }

  selectAll(): void {
    this.selectionMutation.selectAll(this.interactionObjects());
    this.render();
  }

  prepareContextMenu(screenPoint: CanvasPoint): CanvasContextTarget {
    const object = this.objectInteraction.hitObject(
      this.interactionObjects(),
      this.screenToWorld(screenPoint),
    );
    if (!object) {
      this.options.selection.clear();
      this.render();
      return {
        kind: "empty",
        objectId: null,
        selectedIds: [],
        actions: ["paste"],
      };
    }
    if (!this.options.selection.isSelected(object.id))
      this.options.selection.selectObject(object.id);
    this.render();
    const selectedIds = [...this.options.selection.objects];
    const selected = this.options.state.objects.filter((candidate) =>
      selectedIds.includes(candidate.id),
    );
    const common = this.commonContextActions(selected);
    if (selectedIds.length > 1)
      return {
        kind: "multi",
        objectId: object.id,
        selectedIds,
        actions: common,
      };
    const actions: CanvasContextAction[] = [];
    if (object.type === "text") actions.push("edit", "fit");
    if (object.type === "card") {
      const card = object as CanvasCardObject;
      const editable = card.kind === "markdown" || card.kind === "canvas";
      if (editable) actions.push("edit");
      if (card.kind === "markdown" || card.kind === "canvas") actions.push("fit");
    }
    if (object.type === "image") actions.push("crop");
    if (object.type === "video") {
      actions.push("toggle-playback");
      if ((object as VideoObject).mediaId) actions.push("open-original");
    }
    actions.push(...common);
    return {
      kind: object.type,
      objectId: object.id,
      selectedIds,
      mediaId: object.type === "video" ? (object as VideoObject).mediaId : undefined,
      cardKind: object.type === "card" ? (object as CanvasCardObject).kind : undefined,
      actions,
    };
  }

  private commonContextActions(objects: readonly CanvasObject[]): CanvasContextAction[] {
    if (objects.length === 0) return [];
    const copyable = objects.every((object) => object.capabilities.copyable);
    const deletable = objects.every((object) => object.capabilities.deletable);
    const actions: CanvasContextAction[] = [];
    if (copyable && deletable) actions.push("cut");
    if (copyable) actions.push("copy");
    if (deletable) actions.push("delete");
    return actions;
  }

  editObject(objectId: string): boolean {
    const object = this.getObject(objectId);
    if (object?.type === "text") {
      this.beginTextEditing(object as TextObject, true);
      return true;
    }
    if (object?.type === "card") {
      const card = object as CanvasCardObject;
      if (card.kind === "markdown") this.beginMarkdownCardEditing(card);
      else if (card.kind === "template" || card.kind === "revision" || card.kind === "plugin")
        this.options.onObjectActivate?.(card);
      else if (this.options.shouldEnterCardPane?.(card) ?? true) this.enterCard(card);
      else this.options.onObjectActivate?.(card);
      return true;
    }
    return false;
  }

  refreshCardTemplates(): void {
    this.syncTemplateCardDimensions(this.rootState.objects);
    this.invalidateTemplateCardPreviews(this.rootState.objects);
    this.render();
  }

  cropImage(objectId: string): boolean {
    const object = this.getObject(objectId);
    if (object?.type !== "image") return false;
    this.beginImageCrop(object as ImageObject);
    return true;
  }

  async toggleVideo(objectId: string): Promise<boolean> {
    const object = this.getObject(objectId);
    return object?.type === "video" ? videoPlaybackRegistry.toggle(object as VideoObject) : false;
  }

  async copySelection(): Promise<boolean> {
    const selected = this.options.state.objects.filter(
      (object) => this.options.selection.isSelected(object.id) && object.capabilities.copyable,
    );
    if (selected.length === 0) return false;
    const token = this.clipboard.copyElements(selected);
    const fingerprint = await this.systemClipboard.write(selected, token);
    this.clipboard.setSystemFingerprint(fingerprint);
    return true;
  }

  async cutSelection(): Promise<boolean> {
    if (!(await this.copySelection())) return false;
    return this.deleteSelection();
  }

  async pasteClipboard(screenPoint?: CanvasPoint): Promise<boolean> {
    const payload = await this.systemClipboard.read();
    const screen = this.options.engine.app.screen;
    const anchor = this.screenToWorld(
      screenPoint ?? this.pointerScreenPoint ?? { x: screen.width / 2, y: screen.height / 2 },
    );
    if (payload.kind === "elements") {
      this.clipboard.copyElements(payload.elements);
      return this.pasteCanvasElements(anchor);
    }
    if (
      this.clipboard.hasElements &&
      (payload.kind === "empty" || this.clipboard.matchesSystemPayload(payload))
    ) {
      return this.pasteCanvasElements(anchor);
    }
    if (payload.kind === "image") return this.pasteExternalImage(payload.dataUrl, anchor);
    if (payload.kind === "text") return this.pasteExternalText(payload.text, anchor);
    return false;
  }

  private pasteCanvasElements(anchor: CanvasPoint): boolean {
    const pasted = this.clipboard.pasteElements(anchor);
    if (pasted.length === 0 || pasted.some((object) => !this.canInsert(object))) return false;
    for (const object of pasted) {
      this.capabilityPolicy.apply(object);
      if (!normalizeCanvasLayers(this.rootState).some((layer) => layer.id === object.layerId)) {
        this.assignActiveLayer(object);
      }
    }
    this.options.state.objects.push(...pasted);
    for (const object of pasted) this.notifyObjectCreate(object);
    this.options.selection.clear();
    for (const object of pasted) this.options.selection.selectObject(object.id, true);
    this.emitChange();
    this.render();
    return pasted.length > 0;
  }

  private async pasteExternalImage(dataUrl: string, anchor: CanvasPoint): Promise<boolean> {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error("Clipboard image could not be decoded."));
      image.src = dataUrl;
    });
    if (this.options.onExternalImagePaste) {
      const object = await this.options.onExternalImagePaste(
        {
          dataUrl,
          mimeType: /^data:([^;,]+)/.exec(dataUrl)?.[1] ?? "image/png",
          name: "Pasted image.png",
          width: dimensions.width,
          height: dimensions.height,
          point: anchor,
          layerId: this.getActiveLayerId(),
        },
        this.panes.context(),
      );
      if (!object || !this.canInsert(object)) return false;
      this.assignActiveLayer(object);
      this.options.state.objects.push(object);
      this.notifyObjectCreate(object);
      this.options.selection.selectObject(object.id);
      this.emitChange();
      this.render();
      return true;
    }
    const scale = Math.min(1, 320 / Math.max(dimensions.width, dimensions.height));
    const width = dimensions.width * scale;
    const height = dimensions.height * scale;
    const image = new ImageObject({
      id: crypto.randomUUID(),
      type: "image",
      x: anchor.x - width / 2,
      y: anchor.y - height / 2,
      width,
      height,
      rotation: 0,
      opacity: 1,
      src: dataUrl,
      name: "Pasted image",
      sourceWidth: dimensions.width,
      sourceHeight: dimensions.height,
      uploadStatus: "ready",
      lockAspectRatio: true,
      cornerRadius: 0,
    });
    if (!this.canInsert(image)) return false;
    this.assignActiveLayer(image);
    this.options.state.objects.push(image);
    this.notifyObjectCreate(image);
    this.options.selection.selectObject(image.id);
    this.emitChange();
    this.render();
    return true;
  }

  private pasteExternalText(value: string, anchor: CanvasPoint): boolean {
    if (!value) return false;
    const lines = value.split("\n");
    const width = 280;
    const height = Math.max(40, lines.length * 25 + 8);
    const text = new TextObject({
      id: crypto.randomUUID(),
      type: "text",
      x: anchor.x - width / 2,
      y: anchor.y - height / 2,
      width,
      height,
      minHeight: 40,
      sizing: "fixed",
      text: value,
      fontSize: 18,
      lineHeight: 25,
      color: 0x1f2530,
    });
    if (!this.canInsert(text)) return false;
    this.assignActiveLayer(text);
    this.options.state.objects.push(text);
    this.notifyObjectCreate(text);
    this.options.selection.selectObject(text.id);
    this.emitChange();
    this.render();
    return true;
  }

  cancelInteractions(): void {
    if (this.cancelActiveInteraction()) {
      this.render();
      return;
    }
    if (this.options.selection.hasSelection) {
      this.options.selection.clear();
      this.render();
      return;
    }
    this.commitAndExitPane();
  }

  panBy(dx: number, dy: number): void {
    if (this.pendingConnectionArrow) return;
    const viewport = this.options.engine.viewport;
    viewport.x += dx;
    viewport.y += dy;
    this.commitViewportChange();
    this.render();
  }

  overviewSnapshot(): CanvasOverviewSnapshot {
    const engine = this.options.engine;
    return canvasOverviewProjector.snapshot(
      this.options.state,
      {
        x: engine.viewport.x,
        y: engine.viewport.y,
        scale: engine.viewport.scale.x,
      },
      { width: engine.app.screen.width, height: engine.app.screen.height },
    );
  }

  fitAllVisible(options?: CanvasViewportFitOptions): boolean {
    const bounds = canvasVisualBounds.forObjects(this.interactionObjects());
    if (!bounds) return false;
    const screen = this.options.engine.app.screen;
    const viewport = canvasViewportFitter.fit(
      bounds,
      { width: screen.width, height: screen.height },
      options,
    );
    this.applyViewport(viewport);
    return true;
  }

  setViewportCenter(point: CanvasPoint): void {
    const engine = this.options.engine;
    const scale = this.viewportScale;
    this.applyViewport({
      x: engine.app.screen.width / 2 - point.x * scale,
      y: engine.app.screen.height / 2 - point.y * scale,
      scale,
    });
  }

  zoomAt(point: CanvasPoint, deltaY: number): void {
    const oldScale = this.viewportScale;
    this.setZoomAt(point, oldScale * Math.exp(-deltaY * 0.01));
  }

  setZoomAt(point: CanvasPoint, newScale: number): void {
    if (this.pendingConnectionArrow) return;
    const viewport = this.options.engine.viewport;
    const oldScale = viewport.scale.x;
    const scale = Math.max(0.1, Math.min(5, newScale));
    const worldX = (point.x - viewport.x) / oldScale;
    const worldY = (point.y - viewport.y) / oldScale;
    viewport.scale.set(scale);
    viewport.x = point.x - worldX * scale;
    viewport.y = point.y - worldY * scale;
    this.commitViewportChange();
    this.render();
  }

  setZoomAtViewportCenter(newScale: number): number {
    const screen = this.options.engine.app.screen;
    this.setZoomAt({ x: screen.width / 2, y: screen.height / 2 }, newScale);
    return this.viewportScale;
  }

  zoomByAtViewportCenter(delta: number): number {
    return this.setZoomAtViewportCenter(this.viewportScale + delta);
  }

  get viewportScale(): number {
    return this.options.engine.viewport.scale.x;
  }

  endGesture(): void {}

  setTool(tool: CanvasTool): void {
    if (this.options.runtime.tool === tool) {
      return;
    }
    this.commitImageCrop();
    this.creation.cancel();
    this.arrowInteraction.cancel();
    this.addToolDraw = null;
    this.marquee.finish();
    this.drag = null;
    this.options.runtime.creationPreview = null;
    this.options.runtime.arrowPreview = this.pendingConnectionArrow
      ? { arrow: this.pendingConnectionArrow, hintObjectId: null, hotHint: null }
      : null;
    this.options.runtime.arrowHintObjectId = null;
    this.options.runtime.arrowHotHint = null;
    this.options.runtime.marquee = null;
    this.options.cancelTextEditing?.();
    this.options.runtime.tool = tool;
    this.options.engine.setCursor(this.cursorForTool(tool));
    this.render();
  }

  getTool(): CanvasTool {
    return this.options.runtime.tool;
  }

  insertImageAtViewportCenter(): void {
    const screen = this.options.engine.app.screen;
    this.beginImageInsert(this.screenToWorld({ x: screen.width / 2, y: screen.height / 2 }), true);
  }

  insertVideoAtViewportCenter(): void {
    const screen = this.options.engine.app.screen;
    this.beginVideoInsert(this.screenToWorld({ x: screen.width / 2, y: screen.height / 2 }), true);
  }

  private beginSelection(point: CanvasPoint, event: PointerEvent): void {
    const arrowHandle = this.hitArrowHandle(point);
    if (arrowHandle) {
      this.arrowInteraction.beginEdit(
        arrowHandle.arrow,
        arrowHandle.handle,
        point,
        this.interactionObjects(),
      );
      this.options.engine.setCursor("grabbing");
      this.render();
      return;
    }
    const pointerRegion = this.extensionRegistry.hitPointerInteractionRegion(
      this.interactionObjects(),
      point,
    );
    if (pointerRegion && pointerRegion.region.capture !== false) {
      this.options.selection.selectObject(pointerRegion.object.id);
      this.options.runtime.hoveredObjectId = pointerRegion.object.id;
      this.options.runtime.hoveredInteractionObjectId = pointerRegion.object.id;
      this.options.runtime.hoveredInteractionRegionId = pointerRegion.region.id;
      this.pointerInteraction = {
        objectId: pointerRegion.object.id,
        regionId: pointerRegion.region.id,
      };
      const mutated = this.extensionRegistry.activatePointerGesture(
        pointerRegion.object,
        pointerRegion.region.id,
        "start",
        point,
        this.options.state.objects,
      );
      if (mutated) this.emitChange();
      this.options.engine.setCursor(pointerRegion.region.cursor ?? "pointer");
      this.render();
      return;
    }
    const handleHit = this.objectInteraction.hitSelectionHandle(
      this.interactionObjects(),
      this.options.selection.objects,
      point,
      this.viewportScale,
    );
    if (handleHit?.type === "resize") {
      this.drag = this.objectInteraction.createResizeDrag(
        handleHit.object,
        handleHit.descriptor.handle,
        point,
      );
      this.dragMutated = false;
      this.options.engine.setCursor(
        selectionHandles.cursor(handleHit.descriptor.handle, handleHit.object.rotation),
      );
      this.render();
      return;
    }
    if (handleHit?.type === "rotation") {
      const rotationDrag = this.objectInteraction.createRotationDrag(handleHit.object, point);
      if (!rotationDrag) return;
      this.drag = rotationDrag;
      this.dragMutated = false;
      this.options.engine.setCursor("grabbing");
      this.render();
      return;
    }
    if (handleHit?.type === "parameter") {
      this.drag = this.objectInteraction.createParameterDrag(
        handleHit.object,
        handleHit.parameter,
        point,
      );
      if (!this.drag) {
        return;
      }
      this.dragMutated = false;
      this.options.engine.setCursor("grabbing");
      this.render();
      return;
    }

    const object = this.objectInteraction.hitObject(this.interactionObjects(), point);
    if (object) {
      this.beginObjectInteraction(object, point, event);
      return;
    }

    this.marquee.begin(point, this.options.selection, event.shiftKey);
    this.options.runtime.marquee = this.marquee.preview();
    this.render();
  }

  private beginObjectInteraction(
    object: CanvasObject,
    point: CanvasPoint,
    event: PointerEvent,
  ): void {
    if (event.shiftKey) {
      this.options.selection.toggleObject(object.id);
      this.render();
      return;
    }
    if (!this.options.selection.isSelected(object.id)) {
      this.options.selection.selectObject(object.id);
    }
    if (this.options.selection.objects.size > 1) {
      const selected = this.options.state.objects.filter(
        (candidate) =>
          this.options.selection.isSelected(candidate.id) && candidate.capabilities.movable,
      );
      if (selected.length === 0) {
        this.render();
        return;
      }
      this.drag = {
        type: "group-object",
        objectIds: selected.map((candidate) => candidate.id),
        pointerStart: { ...point },
        pointerPrevious: { ...point },
        originals: structuredClone(selected).map((candidate) =>
          canvasObjectFactory.hydrate(candidate),
        ),
      };
      this.dragMutated = false;
      this.options.engine.setCursor("grabbing");
      this.render();
      return;
    }
    if (object.type === "arrow") {
      this.arrowInteraction.beginEdit(
        object as ArrowObject,
        "body",
        point,
        this.interactionObjects(),
      );
      this.options.engine.setCursor("grabbing");
      this.render();
      return;
    }
    if (!object.capabilities.movable) {
      this.render();
      return;
    }
    this.drag = {
      type: "object",
      objectId: object.id,
      pointerStart: { ...point },
      objectStart: { x: object.x, y: object.y },
    };
    this.objectClickCandidate = {
      objectId: object.id,
      screenStart: { ...this.pointerScreenPoint! },
      objectStart: { x: object.x, y: object.y },
    };
    this.dragMutated = false;
    this.options.engine.setCursor("grabbing");
    this.render();
  }

  private beginCreation(tool: CanvasCreationTool, point: CanvasPoint): void {
    this.creation.begin(tool, point);
    this.options.runtime.creationPreview = this.creation.preview();
    this.options.selection.clear();
    this.render();
  }

  private beginPan(point: CanvasPoint): void {
    this.drag = {
      type: "pan",
      pointerStart: point,
      viewportStart: {
        x: this.options.engine.viewport.x,
        y: this.options.engine.viewport.y,
      },
    };
    this.dragMutated = false;
    this.options.engine.setCursor("grabbing");
  }

  private beginTextEditing(draft: TextObject, existing: boolean, caretPoint?: CanvasPoint): void {
    const requestText = this.options.requestText;
    if (!requestText) {
      return;
    }
    const textObject = existing ? draft : null;
    this.options.selection.clear();
    this.options.runtime.editingTextId = textObject?.id ?? "__new_text__";
    this.render();
    const sourceSize =
      draft.format === "markdown"
        ? {
            width: draft.sourceWidth ?? draft.width,
            height: draft.sourceHeight ?? draft.height,
          }
        : { width: draft.width, height: draft.height };
    const request: CanvasTextEditRequest = {
      point: this.worldToScreen({ x: draft.x, y: draft.y }),
      initialValue: draft.text,
      initialSize: sourceSize,
      scale: this.viewportScale,
      rotation: draft.rotation,
      caretPoint: draft.format === "markdown" ? undefined : caretPoint,
      sizing: draft.sizing,
      minHeight: draft.format === "markdown" ? sourceSize.height : draft.minHeight,
      appearance: draft.format === "markdown" ? "markdown-source" : "text",
      style: {
        fontFamily:
          draft.format === "markdown" ? textFontFamily("inter") : textFontFamily(draft.fontFamily),
        fontSize: draft.fontSize,
        fontWeight: draft.fontWeight(),
        italic: draft.italic,
        color: this.colorToCss(draft.color),
        opacity: draft.opacity,
        lineHeight: draft.lineHeight,
        letterSpacing: draft.letterSpacing,
        padding: draft.padding,
        textAlign: draft.textAlign,
      },
    };
    this.activeTextLayout = () => ({
      point: this.worldToScreen({ x: draft.x, y: draft.y }),
      scale: this.viewportScale,
      rotation: draft.rotation,
    });
    void requestText(request).then((result) => {
      this.activeTextLayout = null;
      this.options.runtime.editingTextId = null;
      if (this.disposed) {
        return;
      }
      if (!result) {
        if (textObject) {
          this.options.selection.selectObject(textObject.id);
        }
        this.render();
        this.focus();
        return;
      }
      if (textObject) {
        const previousText = textObject.text;
        textObject.text = result.text;
        if (textObject.format === "markdown") {
          textObject.sourceWidth = result.width;
          textObject.sourceHeight = result.height;
        }
        const size =
          textObject.format === "markdown"
            ? markdownTextRenderer.measure(textObject, true)
            : { width: result.width, height: result.height };
        const nextWidth =
          textObject.format === "markdown"
            ? size.width
            : Math.max(textObject.width, size.width);
        const nextHeight =
          textObject.format === "markdown"
            ? size.height
            : Math.max(textObject.height, textObject.minHeight, size.height);
        const mutated =
          previousText !== result.text ||
          textObject.width !== nextWidth ||
          textObject.height !== nextHeight;
        textObject.width = nextWidth;
        textObject.height = nextHeight;
        this.options.selection.selectObject(textObject.id);
        if (mutated) {
          this.emitChange();
        }
        this.render();
        this.focus();
        return;
      }
      if (!result.text.trim()) {
        this.render();
        this.focus();
        return;
      }
      draft.text = result.text;
      if (draft.format === "markdown") {
        draft.sourceWidth = result.width;
        draft.sourceHeight = result.height;
      }
      const size =
        draft.format === "markdown"
          ? markdownTextRenderer.measure(draft, true)
          : { width: result.width, height: result.height };
      if (draft.format === "markdown") {
        draft.width = size.width;
        draft.height = size.height;
      } else {
        draft.width = Math.max(draft.width, size.width);
        draft.height = Math.max(draft.height, draft.minHeight, size.height);
      }
      if (!this.canInsert(draft)) {
        this.render();
        this.focus();
        return;
      }
      this.assignActiveLayer(draft);
      this.options.state.objects.push(draft);
      this.notifyObjectCreate(draft);
      this.options.selection.selectObject(draft.id);
      this.emitChange();
      this.render();
      this.focus();
      this.requestSelectTool();
    });
  }

  private beginImageInsert(point: CanvasPoint, centerOnPoint = false): void {
    const requestImage = this.options.requestImage;
    if (!requestImage || this.imageRequestPending) {
      return;
    }
    this.imageRequestPending = true;
    void requestImage()
      .then((picked) => {
        if (this.disposed || !picked) {
          return;
        }
        const scale = Math.min(1, 320 / Math.max(picked.width, picked.height));
        const width = Math.max(24, picked.width * scale);
        const height = Math.max(24, picked.height * scale);
        const defaults = this.propertyDefaults.forTool("image");
        const image = new ImageObject({
          id: crypto.randomUUID(),
          type: "image",
          x: centerOnPoint ? point.x - width / 2 : point.x,
          y: centerOnPoint ? point.y - height / 2 : point.y,
          width,
          height,
          rotation: 0,
          opacity: defaults.opacity ?? 1,
          src: picked.dataUrl,
          name: picked.name,
          previewSrc: this.options.uploadImage ? picked.dataUrl : undefined,
          uploadStatus: this.options.uploadImage ? "uploading" : "ready",
          lockAspectRatio: defaults.lockAspectRatio ?? true,
          cornerRadius: defaults.cornerRadius ?? 0,
          sourceWidth: picked.width,
          sourceHeight: picked.height,
        });
        if (!this.canInsert(image)) return;
        this.assignActiveLayer(image);
        this.options.state.objects.push(image);
        this.notifyObjectCreate(image);
        this.options.selection.selectObject(image.id);
        this.emitChange();
        this.render();
        this.requestSelectTool();
        if (this.options.uploadImage) {
          void this.uploadImage(image, picked.dataUrl, picked.name);
        }
      })
      .catch((error) => this.options.onError?.(error))
      .finally(() => {
        this.imageRequestPending = false;
      });
  }

  private beginVideoInsert(point: CanvasPoint, centerOnPoint = false): void {
    const requestVideo = this.options.requestVideo;
    if (!requestVideo || this.imageRequestPending) return;
    this.imageRequestPending = true;
    void requestVideo()
      .then((picked) => {
        if (this.disposed || !picked) return;
        const scale = Math.min(1, 420 / Math.max(picked.width, picked.height));
        const width = Math.max(160, picked.width * scale);
        const height = Math.max(90, picked.height * scale);
        const video = new VideoObject({
          id: crypto.randomUUID(),
          type: "video",
          x: centerOnPoint ? point.x - width / 2 : point.x,
          y: centerOnPoint ? point.y - height / 2 : point.y,
          width,
          height,
          src: picked.src,
          previewSrc: picked.previewSrc,
          posterSrc: picked.posterSrc,
          mediaId: picked.mediaId,
          name: picked.name,
          sourceWidth: picked.width,
          sourceHeight: picked.height,
        });
        if (!this.canInsert(video)) return;
        this.assignActiveLayer(video);
        this.options.state.objects.push(video);
        this.notifyObjectCreate(video);
        this.options.selection.selectObject(video.id);
        this.emitChange();
        this.render();
        this.requestSelectTool();
      })
      .catch((error) => this.options.onError?.(error))
      .finally(() => {
        this.imageRequestPending = false;
      });
  }

  private requestSelectTool(): void {
    if (this.options.runtime.tool !== "select" && this.options.runtime.tool !== "mouse") {
      this.options.onToolRequest?.("select");
    }
  }

  private beginMarkdownCardEditing(card: CanvasCardObject): void {
    const requestText = this.options.requestText;
    if (!requestText) return;
    const original = { markdown: card.markdown, height: card.height };
    const sourceMinimumHeight = card.height;
    this.options.selection.selectObject(card.id);
    this.options.runtime.editingTextId = card.id;
    this.render();
    const scale = this.viewportScale;
    this.activeTextLayout = () => ({
      point: this.worldToScreen({
        x: card.x,
        y: card.y,
      }),
      scale: this.viewportScale,
      rotation: card.rotation,
      width: card.width,
      height: card.height,
      minHeight: sourceMinimumHeight,
      background: this.colorToCss(card.backgroundColor ?? 0xffffff),
      borderRadius: cardBorderGeometry.radiusFor(card.width, card.height),
    });
    void requestText({
      point: this.worldToScreen({
        x: card.x,
        y: card.y,
      }),
      initialValue: card.markdown,
      initialSize: {
        width: card.width,
        height: card.height,
      },
      scale,
      rotation: card.rotation,
      sizing: "fixed",
      minHeight: sourceMinimumHeight,
      appearance: "markdown-live-preview",
      background: this.colorToCss(card.backgroundColor ?? 0xffffff),
      borderRadius: cardBorderGeometry.radiusFor(card.width, card.height),
      onChange: (value) => {
        if (this.disposed || this.getObject(card.id) !== card) return;
        card.markdown = value.text;
        card.height = Math.max(card.height, value.height);
        this.render();
      },
      style: {
        fontFamily: textFontFamily("inter"),
        fontSize: markdownTypography.fontSize,
        fontWeight: "400",
        italic: false,
        color: "#1f2530",
        opacity: card.opacity,
        lineHeight: markdownTypography.lineHeight,
        letterSpacing: 0,
        padding: markdownCardLayout.sidePadding,
        textAlign: "left",
      },
    }).then((result) => {
      this.activeTextLayout = null;
      this.options.runtime.editingTextId = null;
      if (this.disposed) return;
      if (!result) {
        card.markdown = original.markdown;
        card.height = original.height;
        this.render();
        this.focus();
        return;
      }
      card.markdown = result.text;
      card.height = Math.max(card.height, result.height);
      if (card.markdown !== original.markdown || Math.abs(card.height - original.height) >= 0.5) {
        this.emitChange();
      }
      this.render();
      this.focus();
    });
  }

  private async uploadImage(image: ImageObject, dataUrl: string, name: string): Promise<void> {
    try {
      const uploaded = await this.options.uploadImage?.(dataUrl, name);
      if (!uploaded || this.disposed || !this.getObject(image.id)) {
        return;
      }
      image.src = uploaded.url;
      image.name = uploaded.name;
      image.previewSrc = undefined;
      image.uploadStatus = "ready";
      this.emitChange();
      this.render();
    } catch (error) {
      image.uploadStatus = "failed";
      this.options.onError?.(error);
      this.emitChange();
      this.render();
    }
  }

  private beginImageCrop(image: ImageObject): void {
    this.creation.cancel();
    this.arrowInteraction.cancel();
    this.drag = null;
    this.imageCrop = new CanvasImageCropSession(image);
    this.options.runtime.imageCrop = this.imageCrop.preview();
    this.options.selection.selectObject(image.id);
    this.options.onCropRequest?.({
      imageId: image.id,
      name: image.name,
      crop: { ...(image.crop ?? { x: 0, y: 0, width: 1, height: 1 }) },
    });
    this.render();
  }

  private commitImageCrop(): void {
    const session = this.imageCrop;
    if (!session) {
      return;
    }
    const mutated = session.commit();
    this.imageCrop = null;
    this.options.runtime.imageCrop = null;
    if (mutated) {
      this.emitChange();
    }
    this.render();
  }

  private cancelImageCrop(): void {
    if (!this.imageCrop) {
      return;
    }
    const imageId = this.imageCrop.imageId;
    this.imageCrop.cancel();
    this.imageCrop = null;
    this.options.runtime.imageCrop = null;
    this.options.selection.selectObject(imageId);
    this.render();
  }

  private updateHover(point: CanvasPoint): void {
    const previousConnectionHint = this.options.runtime.arrowHintObjectId;
    const interactionEnabled =
      this.options.runtime.tool === "select" || this.options.runtime.tool === "mouse";
    const pointerRegion = interactionEnabled
      ? this.extensionRegistry.hitPointerInteractionRegion(this.interactionObjects(), point)
      : null;
    const permanentHandle = pointerRegion ? null : this.hitPermanentConnectionHandle(point);
    if (permanentHandle) {
      this.options.runtime.arrowHintObjectId = permanentHandle.object.id;
      this.options.runtime.arrowHotHint = permanentHandle.hint;
    } else if (this.options.runtime.tool === "arrow" || this.options.runtime.tool === "line") {
      this.arrowInteraction.updateHint(point, this.interactionObjects(), this.viewportScale);
      const hint = this.arrowInteraction.hint();
      this.options.runtime.arrowHintObjectId = hint.objectId;
      this.options.runtime.arrowHotHint = hint.hotHint;
    } else {
      this.options.runtime.arrowHintObjectId = null;
      this.options.runtime.arrowHotHint = null;
    }
    const object = this.objectInteraction.hitObject(this.interactionObjects(), point);
    const objectId = object?.id ?? null;
    void previousConnectionHint;
    this.options.runtime.hoveredObjectId = objectId;

    const handleHit =
      this.options.runtime.tool === "select" || this.options.runtime.tool === "mouse"
        ? this.objectInteraction.hitSelectionHandle(
            this.interactionObjects(),
            this.options.selection.objects,
            point,
            this.viewportScale,
          )
        : null;
    const arrowHandle =
      this.options.runtime.tool === "select" || this.options.runtime.tool === "mouse"
        ? this.hitArrowHandle(point)
        : null;
    this.options.runtime.hoveredInteractionObjectId = pointerRegion?.object.id ?? null;
    this.options.runtime.hoveredInteractionRegionId = pointerRegion?.region.id ?? null;
    if (permanentHandle) {
      this.options.engine.setCursor("crosshair");
    } else if (arrowHandle) {
      this.options.engine.setCursor("grab");
    } else if (pointerRegion) {
      this.options.engine.setCursor(pointerRegion.region.cursor ?? "pointer");
    } else if (handleHit?.type === "resize") {
      this.options.engine.setCursor(
        selectionHandles.cursor(handleHit.descriptor.handle, handleHit.object.rotation),
      );
    } else if (handleHit?.type === "rotation") {
      this.options.engine.setCursor("grab");
    } else if (
      (this.options.runtime.tool === "select" || this.options.runtime.tool === "mouse") &&
      object
    ) {
      this.options.engine.setCursor("grab");
    } else {
      this.options.engine.setCursor(this.cursorForTool(this.options.runtime.tool));
    }
    this.render();
  }

  private hitArrowHandle(
    point: CanvasPoint,
  ): { arrow: ArrowObject; handle: ArrowEditHandle } | null {
    const objects = this.interactionObjects();
    for (let index = objects.length - 1; index >= 0; index--) {
      const object = objects[index];
      if (object.type !== "arrow" || !this.options.selection.isSelected(object.id)) continue;
      const arrow = object as ArrowObject;
      const handle = this.arrowInteraction.hitHandle(arrow, objects, point, this.viewportScale);
      if (handle) return { arrow, handle };
    }
    return null;
  }

  private hitPermanentConnectionHandle(point: CanvasPoint): {
    object: CanvasObject;
    hint: import("../model/arrow/arrow.ts").ArrowHint;
    point: CanvasPoint;
    anchor: CanvasPoint;
  } | null {
    const objects = this.interactionObjects();
    const radius = 10 / Math.max(this.viewportScale, 0.001);
    for (let index = objects.length - 1; index >= 0; index--) {
      const object = objects[index];
      if (!this.extensionRegistry.hasPermanentConnectionHandles(object)) continue;
      const hit = (this.connectionHintsFor(object, "source") ?? []).reduce<
        ReturnType<typeof arrowBindingResolver.hints>[number] | null
      >((nearest, hint) => {
        const distance = Math.hypot(point.x - hint.point.x, point.y - hint.point.y);
        if (distance > radius) return nearest;
        if (!nearest) return hint;
        const nearestDistance = Math.hypot(point.x - nearest.point.x, point.y - nearest.point.y);
        return distance < nearestDistance ? hint : nearest;
      }, null);
      if (hit) return { object, ...hit };
    }
    return null;
  }

  private normalizePermanentConnectionBindings(objects: readonly CanvasObject[]): void {
    for (const object of objects) {
      if (object.type !== "arrow") continue;
      const arrow = object as ArrowObject;
      for (const endpoint of [arrow.start, arrow.end]) {
        if (!endpoint.binding) continue;
        const host = objects.find((candidate) => candidate.id === endpoint.binding?.objectId);
        if (!host || !this.extensionRegistry.hasPermanentConnectionHandles(host)) continue;
        const hints = this.connectionHintsFor(host, "any") ?? arrowBindingResolver.hints(host);
        if (hints.length === 0) continue;
        if (endpoint.binding.hint && hints.some((hint) => hint.hint === endpoint.binding?.hint)) {
          continue;
        }
        const currentPoint = arrowBindingResolver.resolve(endpoint, objects);
        const hint = hints.reduce((nearest, candidate) =>
          Math.hypot(candidate.point.x - currentPoint.x, candidate.point.y - currentPoint.y) <
          Math.hypot(nearest.point.x - currentPoint.x, nearest.point.y - currentPoint.y)
            ? candidate
            : nearest,
        );
        endpoint.binding.hint = hint.hint;
        endpoint.binding.anchor = { ...hint.anchor };
        endpoint.point = { ...hint.point };
      }
      arrow.updateBounds(
        arrowBindingResolver.resolve(arrow.start, objects),
        arrowBindingResolver.resolve(arrow.end, objects),
      );
    }
  }

  private connectionHintsFor(
    object: CanvasObject,
    endpoint: "source" | "target" | "any",
  ): ReturnType<typeof arrowBindingResolver.hints> | null {
    const handles = this.extensionRegistry.connectionHandles(object);
    if (!handles) return null;
    const filtered = handles.filter(
      (handle) =>
        endpoint === "any" ||
        handle.direction === undefined ||
        handle.direction === "both" ||
        (endpoint === "source" ? handle.direction === "output" : handle.direction === "input"),
    );
    return arrowBindingResolver.hintsFrom(object, filtered);
  }

  private scheduleMarkdownRefit(): void {
    if (this.disposed || this.latexRefitQueued) return;
    this.latexRefitQueued = true;
    queueMicrotask(() => {
      this.latexRefitQueued = false;
      if (this.disposed) return;
      let mutated = false;
      for (const object of this.options.state.objects) {
        if (object.type !== "text" || (object as TextObject).format !== "markdown") continue;
        const text = object as TextObject;
        const size = markdownTextRenderer.measure(text, true);
        const width = size.width;
        const height = size.height;
        if (Math.abs(text.width - width) < 0.5 && Math.abs(text.height - height) < 0.5) {
          continue;
        }
        text.width = width;
        text.height = height;
        mutated = true;
      }
      if (mutated) this.emitChange();
      this.render();
    });
  }

  private emitChange(): boolean {
    const history = this.currentHistory();
    if (history.hasPendingChange) return true;
    const changed = history.record();
    if (!changed) return false;
    this.panes.markDirty();
    this.notifyHistory();
    return true;
  }

  private notifySelection(): void {
    if (!this.options.onSelectionChange) return;
    const selectedIds = [...this.options.selection.objects];
    const selectedObjects = this.options.state.objects.filter((object) =>
      this.options.selection.isSelected(object.id),
    );
    const viewport = this.options.engine.viewport;
    const primaryObject =
      this.options.state.objects.find(
        (object) => object.id === this.options.selection.primaryObjectId,
      ) ?? null;
    const signature = JSON.stringify([
      selectedIds,
      selectedObjects,
      primaryObject,
      viewport.x,
      viewport.y,
      viewport.scale.x,
    ]);
    if (signature === this.selectionSignature) return;
    this.selectionSignature = signature;
    this.options.onSelectionChange({
      selectedIds,
      selectedObjects,
      primaryObject,
      viewport: { x: viewport.x, y: viewport.y, scale: viewport.scale.x },
    });
  }

  private async finishConnectionDrop(arrow: ArrowObject, screenPoint: CanvasPoint): Promise<void> {
    const source = this.options.state.objects.find(
      (object) => object.id === arrow.start.binding?.objectId,
    );
    if (!source || !this.options.onConnectionDrop) return;
    this.pendingConnectionArrow = arrow;
    this.options.runtime.arrowPreview = { arrow, hintObjectId: null, hotHint: null };
    try {
      const target = await this.options.onConnectionDrop({
        arrow,
        sourceObject: source,
        worldPoint: this.screenToWorld(screenPoint),
        screenPoint: { ...screenPoint },
      });
      if (this.disposed || !target) return;
      if (!this.canInsert(target) || !this.canInsert(arrow)) return;
      this.capabilityPolicy.apply(target);
      this.assignActiveLayer(target);
      const sourcePoint = arrowBindingResolver.resolve(arrow.start, this.options.state.objects);
      const targetHints = this.connectionHintsFor(target, "target");
      const hints = targetHints?.length
        ? targetHints
        : (this.connectionHintsFor(target, "any") ?? arrowBindingResolver.hints(target));
      if (hints.length === 0) return;
      const hint = hints.reduce((nearest, candidate) =>
        Math.hypot(candidate.point.x - sourcePoint.x, candidate.point.y - sourcePoint.y) <
        Math.hypot(nearest.point.x - sourcePoint.x, nearest.point.y - sourcePoint.y)
          ? candidate
          : nearest,
      );
      arrow.end = {
        point: { ...hint.point },
        binding: { objectId: target.id, anchor: { ...hint.anchor }, hint: hint.hint },
      };
      arrow.updateBounds(sourcePoint, hint.point);
      this.assignActiveLayer(arrow);
      this.options.state.objects.push(target, arrow);
      this.notifyObjectCreate(target);
      this.notifyObjectCreate(arrow);
      this.options.selection.selectObject(target.id);
      this.emitChange();
      this.clearPendingConnection(arrow);
      this.requestSelectTool();
    } catch (error) {
      this.options.onError?.(error);
    } finally {
      this.clearPendingConnection(arrow);
      this.render();
    }
  }

  private clearPendingConnection(arrow: ArrowObject): void {
    if (this.pendingConnectionArrow !== arrow) return;
    this.pendingConnectionArrow = null;
    this.options.runtime.arrowPreview = null;
  }

  private hasActiveInteraction(): boolean {
    return Boolean(
      this.imageCrop ||
      this.creation.active ||
      this.arrowInteraction.creating ||
      this.arrowInteraction.editing ||
      this.addToolDraw ||
      this.marquee.active ||
      this.drag ||
      this.pointerInteraction ||
      this.options.runtime.editingTextId,
    );
  }

  private cancelActiveInteraction(): boolean {
    if (!this.hasActiveInteraction()) return false;
    if (this.imageCrop) this.cancelImageCrop();
    this.creation.cancel();
    this.arrowInteraction.cancel();
    this.addToolDraw = null;
    this.marquee.cancel(this.options.selection);
    this.restoreDrag();
    this.drag = null;
    if (this.pointerInteraction) {
      const interaction = this.pointerInteraction;
      const object = this.options.state.objects.find((candidate) => candidate.id === interaction.objectId);
      if (object) {
        const point = this.pointerScreenPoint
          ? this.screenToWorld(this.pointerScreenPoint)
          : { x: object.x + object.width / 2, y: object.y + object.height / 2 };
        if (this.extensionRegistry.activatePointerGesture(
          object,
          interaction.regionId,
          "cancel",
          point,
          this.options.state.objects,
        )) this.emitChange();
      }
      this.pointerInteraction = null;
    }
    this.dragMutated = false;
    this.options.runtime.creationPreview = null;
    this.options.runtime.arrowPreview = null;
    this.options.runtime.arrowHintObjectId = null;
    this.options.runtime.arrowHotHint = null;
    this.options.runtime.marquee = null;
    if (this.options.runtime.editingTextId) {
      this.options.cancelTextEditing?.();
      this.options.runtime.editingTextId = null;
    }
    this.options.engine.setCursor(this.cursorForTool(this.options.runtime.tool));
    return true;
  }

  private restoreDrag(): void {
    const drag = this.drag;
    if (!drag) return;
    if (drag.type === "pan") {
      this.options.engine.viewport.position.set(drag.viewportStart.x, drag.viewportStart.y);
      return;
    }
    if (drag.type === "draw-object") return;
    if (drag.type === "group-object") {
      const originals = new Map(drag.originals.map((object) => [object.id, object]));
      for (let index = 0; index < this.options.state.objects.length; index++) {
        const original = originals.get(this.options.state.objects[index].id);
        if (original)
          this.options.state.objects[index] = canvasObjectFactory.hydrate(
            structuredClone(original),
          );
      }
      return;
    }
    const object = this.getObject(drag.objectId);
    if (!object) return;
    if (drag.type === "object") {
      object.translate(drag.objectStart.x - object.x, drag.objectStart.y - object.y);
    } else if (drag.type === "resize-object") {
      Object.assign(object, drag.originalBounds);
      object.rotation = drag.originalRotation;
    } else if (drag.type === "rotate-object") {
      Object.assign(object, drag.originalBounds);
      object.rotation = drag.originalRotation;
    } else if (drag.type === "adjust-shape-parameter" && shapeGeometry.isShape(object)) {
      shapeGeometry.setParameterValue(object, drag.parameter, drag.originalValue);
    }
  }

  private centerViewport(objects: readonly CanvasObject[]): void {
    const bounds = canvasVisualBounds.forObjects(objects);
    const center = bounds
      ? { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
      : { x: 0, y: 0 };
    const viewport = this.options.engine.viewport;
    viewport.scale.set(1);
    viewport.position.set(
      this.options.engine.app.screen.width / 2 - center.x,
      this.options.engine.app.screen.height / 2 - center.y,
    );
  }

  private notifyProperties(): void {
    const context = this.propertyContext();
    const signature = this.propertyContextBuilder.signature(context);
    if (signature === this.propertiesSignature) return;
    this.propertiesSignature = signature;
    this.options.onPropertiesChange?.(context);
    for (const listener of this.propertyListeners) listener(context);
  }

  private getObject(id: string): CanvasObject | undefined {
    return this.options.state.objects.find((object) => object.id === id);
  }

  private interactionObjects(): CanvasObject[] {
    return visibleCanvasObjects(this.options.state);
  }

  private assignActiveLayer(object: CanvasObject): void {
    this.capabilityPolicy.apply(object);
    object.layerId =
      this.rootState.activeLayerId ?? normalizeCanvasLayers(this.rootState).at(-1)!.id;
  }

  private canInsert(object: CanvasObject): boolean {
    return this.options.canInsertObject?.(object, this.panes.context()) ?? true;
  }

  private notifyObjectCreate(object: CanvasObject): void {
    this.options.onObjectCreate?.(object, this.panes.context());
  }

  private enforceMinimumSize(object: CanvasObject): void {
    const minimum = this.extensionRegistry.minimumSize(object);
    if (!minimum) return;
    object.width = Math.max(object.width, minimum.width ?? 0);
    object.height = Math.max(object.height, minimum.height ?? 0);
  }

  private syncTemplateCardDimensions(objects: readonly CanvasObject[]): void {
    for (const object of objects) {
      if (object.type !== "card") continue;
      const card = object as CanvasCardObject;
      if (card.kind === "template") {
        const template = this.options.cardTemplates?.get((card as TemplateCard).templateId);
        card.capabilities.resizable = false;
        if (template) {
          card.width = template.width;
          card.height = template.height;
        }
      } else if (card.kind === "plugin") {
        const definition = this.options.pluginCards?.get((card as PluginCard).pluginId);
        card.capabilities.resizable = false;
        if (definition) {
          card.width = definition.width;
          card.height =
            definition.sizePolicy === "grow-height"
              ? Math.max(card.height, definition.height)
              : definition.height;
        }
      } else {
        this.syncTemplateCardDimensions(card.elements);
      }
    }
  }

  private invalidateTemplateCardPreviews(objects: readonly CanvasObject[]): void {
    for (const object of objects) {
      if (object.type !== "card") continue;
      const card = object as CanvasCardObject;
      if (card.kind === "template" || card.kind === "plugin")
        this.options.engine.invalidateCardPreview(card.id);
      else this.invalidateTemplateCardPreviews(card.elements);
    }
  }

  private placeAddToolObject(point: CanvasPoint): void {
    const object = this.options.onAddToolPlacement?.(point);
    if (!object) return;
    this.insertObject(object);
    this.requestSelectTool();
  }

  private syncLayerState(activeLayerId: string, focusedLayerId: string | null): void {
    this.rootState.activeLayerId = activeLayerId;
    this.rootState.focusedLayerId = focusedLayerId;
    this.options.state.layers = this.rootState.layers;
    this.options.state.activeLayerId = activeLayerId;
    this.options.state.focusedLayerId = focusedLayerId;
    this.options.state.unfocusedLayerOpacity = this.rootState.unfocusedLayerOpacity;
  }

  private clearSelectionForLayer(layerId: string): void {
    const selected = this.options.selection.objects;
    if (
      this.rootState.objects.some((object) => object.layerId === layerId && selected.has(object.id))
    ) {
      this.options.selection.clear();
      this.options.runtime.hoveredObjectId = null;
      this.options.runtime.hoveredInteractionObjectId = null;
      this.options.runtime.hoveredInteractionRegionId = null;
    }
  }

  private commitLayerChange(): void {
    this.options.state.layers = this.rootState.layers;
    this.options.state.activeLayerId = this.rootState.activeLayerId;
    this.options.state.focusedLayerId = this.rootState.focusedLayerId;
    this.options.state.unfocusedLayerOpacity = this.rootState.unfocusedLayerOpacity;
    this.emitChange();
    this.render();
  }

  private commitLayerNavigationChange(): void {
    this.options.state.layers = this.rootState.layers;
    this.options.state.activeLayerId = this.rootState.activeLayerId;
    this.options.state.focusedLayerId = this.rootState.focusedLayerId;
    this.options.state.unfocusedLayerOpacity = this.rootState.unfocusedLayerOpacity;
    this.options.onChange?.();
    this.render();
  }

  private createHistoryScope(rootScope: boolean): CanvasHistoryController<CanvasContentSnapshot> {
    return new CanvasHistoryController<CanvasContentSnapshot>({
      maxEntries: 100,
      capture: () => this.captureContent(rootScope),
      restore: (snapshot) => this.restoreContent(snapshot, rootScope),
    });
  }

  private currentHistory(): CanvasHistoryController<CanvasContentSnapshot> {
    return this.historyScopes.at(-1)!;
  }

  private captureContent(rootScope: boolean): CanvasContentSnapshot {
    return {
      objects: structuredClone(this.options.state.objects),
      layers: rootScope ? structuredClone(this.rootState.layers ?? []) : undefined,
      unfocusedLayerOpacity: rootScope ? this.rootState.unfocusedLayerOpacity : undefined,
    };
  }

  private restoreContent(snapshot: CanvasContentSnapshot, rootScope: boolean): void {
    const objects = structuredClone(snapshot.objects).map((object) => {
      const hydrated = canvasObjectFactory.hydrate(object);
      this.capabilityPolicy.apply(hydrated);
      return hydrated;
    });
    this.syncTemplateCardDimensions(objects);
    this.options.state.objects = objects;
    if (rootScope) {
      this.rootState.objects = objects;
      this.rootState.layers = structuredClone(snapshot.layers ?? []);
      this.rootState.unfocusedLayerOpacity = snapshot.unfocusedLayerOpacity;
      normalizeCanvasLayers(this.rootState);
      this.options.state.layers = this.rootState.layers;
      this.options.state.activeLayerId = this.rootState.activeLayerId;
      this.options.state.focusedLayerId = this.rootState.focusedLayerId;
      this.options.state.unfocusedLayerOpacity = this.rootState.unfocusedLayerOpacity;
    }
    this.options.selection.clear();
    this.options.runtime.hoveredObjectId = null;
    this.options.runtime.hoveredInteractionObjectId = null;
    this.options.runtime.hoveredInteractionRegionId = null;
    this.options.runtime.arrowHintObjectId = null;
    this.options.runtime.arrowHotHint = null;
  }

  private afterHistoryRestore(): void {
    this.panes.markDirty();
    this.notifyHistory();
    this.render();
  }

  private notifyHistory(): void {
    this.options.onHistoryChange?.(this.currentHistory().state);
  }

  private clampOpacity(value: number | undefined, fallback = 1): number {
    return Math.min(1, Math.max(0, Number.isFinite(value) ? value! : fallback));
  }

  private normalizeInteractionColor(value: number | undefined): number {
    return Number.isInteger(value) && value! >= 0 && value! <= 0xffffff ? value! : 0x3b82f6;
  }

  private commitViewportChange(): void {
    const viewport = this.options.engine.viewport;
    const next = { x: viewport.x, y: viewport.y, scale: viewport.scale.x };
    this.rootState.viewport = next;
    this.options.state.viewport = next;
    this.options.onViewportChange?.(next);
  }

  private applyViewport(viewport: CanvasViewport): void {
    const target = this.options.engine.viewport;
    target.position.set(viewport.x, viewport.y);
    target.scale.set(viewport.scale);
    this.commitViewportChange();
    this.render();
  }

  private screenToWorld(point: CanvasPoint): CanvasPoint {
    const viewport = this.options.engine.viewport;
    const scale = viewport.scale.x;
    return {
      x: (point.x - viewport.x) / scale,
      y: (point.y - viewport.y) / scale,
    };
  }

  private worldToScreen(point: CanvasPoint): CanvasPoint {
    const viewport = this.options.engine.viewport;
    return {
      x: viewport.x + point.x * viewport.scale.x,
      y: viewport.y + point.y * viewport.scale.y,
    };
  }

  private colorToCss(color: number): string {
    return `#${color.toString(16).padStart(6, "0")}`;
  }

  private isCreationTool(tool: CanvasTool): tool is CanvasCreationTool {
    return [
      "card",
      "markdown-card",
      "text",
      "markdown",
      "rect",
      "ellipse",
      "diamond",
      "pentagon",
      "parallelogram",
      "pencil",
    ].includes(tool);
  }

  private cursorForTool(tool: CanvasTool): string {
    switch (tool) {
      case "hand":
        return "grab";
      case "card":
      case "markdown-card":
      case "text":
      case "markdown":
      case "image":
      case "video":
      case "rect":
      case "ellipse":
      case "diamond":
      case "pentagon":
      case "parallelogram":
      case "arrow":
      case "line":
      case "pencil":
        return "crosshair";
      case "mouse":
      case "select":
      case "add":
        return "default";
    }
  }
}
