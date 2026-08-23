import { canvasVisualBounds, shapeGeometry, type CanvasEngine } from "../engine";
import { selectionHandles } from "../engine/renderers/selection-handles";
import { ArrowObject, ImageObject, TextObject, type CanvasObject, type TextFormat } from "../model";
import { textFontFamily } from "../model/text";
import { configureLatexRenderer } from "../latex";
import { markdownTextRenderer } from "../markdown";
import {
  CanvasPropertyContextBuilder,
  CanvasPropertyDefaults,
  CanvasPropertyMutation,
  type CanvasPropertiesListener,
  type CanvasPropertyContext,
  type CanvasPropertyPatch,
} from "../properties";
import type {
  CanvasTool,
  CanvasImageCropRequest,
  EndlessCanvasRuntimeState,
  EndlessCanvasState,
  CanvasPoint,
  CanvasPaneChangeListener,
  CanvasPaneContext,
} from "../types";
import type {
  CanvasTextEditRequest,
  CanvasTextEditResult,
  KeyboardShortcutAction,
} from "../interaction";
import type { CanvasDragEvent } from "./canvas-drag";
import { CanvasCreationSession, type CanvasCreationTool } from "./creation-session";
import { CanvasArrowInteraction, type ArrowEditHandle } from "./arrow-interaction";
import { CanvasMarqueeSelection } from "./marquee-selection";
import { CanvasObjectInteraction } from "./object-interaction";
import type { CanvasSelectionController } from "./selection";
import { CanvasSelectionMutation } from "./selection-mutation";
import { CanvasImageCropSession } from "./image-crop-session";
import { CanvasPaneController } from "./pane-navigation";
import type { CanvasCardObject } from "../model/card";

export type { CanvasDragEvent, CanvasDragEventType } from "./canvas-drag";

export interface CanvasImageSelection {
  dataUrl: string;
  name: string;
  width: number;
  height: number;
}

export interface CanvasControllerOptions {
  engine: CanvasEngine;
  selection: CanvasSelectionController;
  state: EndlessCanvasState;
  runtime: EndlessCanvasRuntimeState;
  onChange?: () => void;
  onError?: (error: unknown) => void;
  requestText?: (request: CanvasTextEditRequest) => Promise<CanvasTextEditResult | null>;
  cancelTextEditing?: () => void;
  commitTextEditing?: () => void;
  requestImage?: () => Promise<CanvasImageSelection | null>;
  uploadImage?: (dataUrl: string, name: string) => Promise<{ url: string; name: string }>;
  onCropRequest?: (request: CanvasImageCropRequest) => void;
  defaultTextFormat?: TextFormat;
  onPropertiesChange?: CanvasPropertiesListener;
  maxPaneDepth?: number;
  onPaneChange?: CanvasPaneChangeListener;
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
  private imageCrop: CanvasImageCropSession | null = null;
  private dragMutated = false;
  private disposed = false;
  private latexRefitQueued = false;
  private propertiesSignature = "";

  constructor(options: CanvasControllerOptions) {
    this.rootState = options.state;
    this.options = {
      ...options,
      state: { objects: options.state.objects },
    };
    this.propertyDefaults = new CanvasPropertyDefaults({
      text: { format: options.defaultTextFormat ?? "plain" },
    });
    this.creation = new CanvasCreationSession(this.propertyDefaults);
    this.arrowInteraction = new CanvasArrowInteraction(this.propertyDefaults);
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
      },
      centerViewport: (objects) => this.centerViewport(objects),
      onRootChange: options.onChange,
      onPaneChange: options.onPaneChange,
      onCardCommit: (card) => options.engine.invalidateCardPreview(card.id),
    });
    configureLatexRenderer(() => {
      markdownTextRenderer.invalidateResolvedLatex();
      this.scheduleMarkdownRefit();
    });
  }

  render(): void {
    if (!this.disposed) {
      this.options.engine.render(this.options.state, this.options.runtime, this.rootState.objects);
      this.notifyProperties();
    }
  }

  focus(): void {
    this.options.engine.focus();
  }

  destroy(): void {
    this.disposed = true;
    this.options.cancelTextEditing?.();
    this.propertyListeners.clear();
  }

  paneContext(): CanvasPaneContext {
    return this.panes.context();
  }

  getPaneContext(): CanvasPaneContext {
    return this.paneContext();
  }

  subscribePaneChange(listener: CanvasPaneChangeListener): () => void {
    return this.panes.subscribe(listener);
  }

  enterCard(cardOrId: CanvasCardObject | string): boolean {
    if (this.hasActiveInteraction()) this.cancelActiveInteraction();
    const entered = this.panes.enter(cardOrId);
    if (!entered) return false;
    this.options.runtime.hoveredObjectId = null;
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
    this.options.runtime.hoveredObjectId = null;
    this.render();
    return true;
  }

  exitPane(): boolean {
    return this.commitAndExitPane();
  }

  fitCardToContent(cardOrId: CanvasCardObject | string): boolean {
    const changed = this.panes.fit(cardOrId);
    if (changed) this.render();
    return changed;
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
      if (patch.format !== undefined) markdownTextRenderer.invalidate(text.id);
      else markdownTextRenderer.invalidateMeasurement(text.id);
      if (text.format === "markdown") {
        const size = markdownTextRenderer.measure(text);
        text.width = size.width;
        text.height = size.height;
      } else {
        markdownTextRenderer.dispose(text.id);
      }
    }
    this.emitChange();
    this.render();
    return changes;
  }

  pointerDown(point: CanvasPoint, event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    if (this.options.runtime.editingTextId) {
      this.options.commitTextEditing?.();
      return;
    }

    const worldPoint = this.screenToWorld(point);
    if (this.imageCrop) {
      if (this.imageCrop.beginDrag(worldPoint, this.viewportScale)) {
        this.options.engine.setCursor("move");
        return;
      }
      if (this.imageCrop.containsSource(worldPoint)) {
        return;
      }
      this.commitImageCrop();
    }
    const tool = this.options.runtime.tool;

    if (tool === "arrow" || tool === "line") {
      this.arrowInteraction.beginCreation(
        tool,
        worldPoint,
        this.options.state.objects,
        this.viewportScale,
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
      case "add":
        return;
    }
  }

  pointerMove(point: CanvasPoint, event: PointerEvent): void {
    if (this.imageCrop) {
      if (this.imageCrop.update(this.screenToWorld(point), this.viewportScale)) {
        this.options.runtime.imageCrop = this.imageCrop.preview();
        this.render();
      }
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
        this.options.state.objects,
        this.viewportScale,
      );
      this.options.runtime.arrowPreview = this.arrowInteraction.preview();
      this.render();
      return;
    }

    if (this.arrowInteraction.editing) {
      this.arrowInteraction.updateEdit(
        this.screenToWorld(point),
        this.options.state.objects,
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
        this.options.state.objects,
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
      case "resize-object": {
        const object = this.getObject(drag.objectId);
        if (!object) {
          this.drag = null;
          return;
        }
        const before = object.bounds();
        this.objectInteraction.resize(object, drag, this.screenToWorld(point), event.shiftKey);
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

  pointerUp(_point: CanvasPoint, _event: PointerEvent): void {
    void _point;
    void _event;
    if (this.imageCrop) {
      this.imageCrop.endDrag();
      this.options.engine.setCursor(this.cursorForTool(this.options.runtime.tool));
      this.render();
      return;
    }
    if (this.creation.active) {
      const object = this.creation.finish();
      this.options.runtime.creationPreview = null;
      if (object?.type === "text") {
        this.beginTextEditing(object as TextObject, false);
      } else if (object) {
        this.options.state.objects.push(object);
        this.options.selection.selectObject(object.id);
        this.emitChange();
      }
      this.options.engine.setCursor(this.cursorForTool(this.options.runtime.tool));
      this.render();
      return;
    }

    if (this.arrowInteraction.creating) {
      const arrow = this.arrowInteraction.finishCreation(this.options.state.objects);
      this.options.runtime.arrowPreview = null;
      this.options.runtime.arrowHintObjectId = null;
      this.options.runtime.arrowHotHint = null;
      if (arrow) {
        this.options.state.objects.push(arrow);
        this.options.selection.selectObject(arrow.id);
        this.emitChange();
      }
      this.render();
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

    if (this.dragMutated) {
      this.emitChange();
    }
    this.drag = null;
    this.dragMutated = false;
    this.options.engine.setCursor(this.cursorForTool(this.options.runtime.tool));
    this.render();
  }

  executeShortcut(action: KeyboardShortcutAction): void {
    switch (action) {
      case "delete-selection":
        this.deleteSelection();
        return;
      case "select-all":
        this.selectAll();
        return;
      case "cancel":
        this.cancelInteractions();
        return;
      case "commit-interaction":
        this.commitImageCrop();
    }
  }

  doubleClick(point: CanvasPoint): void {
    if (this.imageCrop) {
      this.commitImageCrop();
      return;
    }
    if (this.options.runtime.tool !== "select" && this.options.runtime.tool !== "mouse") {
      return;
    }
    const object = this.objectInteraction.hitObject(
      this.options.state.objects,
      this.screenToWorld(point),
    );
    if (object?.type === "card") {
      this.enterCard(object as CanvasCardObject);
    } else if (object?.type === "image") {
      this.beginImageCrop(object as ImageObject);
    } else if (object?.type === "text") {
      this.beginTextEditing(object as TextObject, true, point);
    }
  }

  deleteSelection(): boolean {
    if (this.imageCrop) {
      this.cancelImageCrop();
    }
    const mutated = this.selectionMutation.deleteSelection();
    if (!mutated) {
      return false;
    }
    this.options.runtime.hoveredObjectId = null;
    this.emitChange();
    this.render();
    return true;
  }

  selectAll(): void {
    this.selectionMutation.selectAll();
    this.render();
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
    const viewport = this.options.engine.viewport;
    viewport.x += dx;
    viewport.y += dy;
    this.render();
  }

  zoomAt(point: CanvasPoint, deltaY: number): void {
    const oldScale = this.viewportScale;
    this.setZoomAt(point, oldScale * Math.exp(-deltaY * 0.01));
  }

  setZoomAt(point: CanvasPoint, newScale: number): void {
    const viewport = this.options.engine.viewport;
    const oldScale = viewport.scale.x;
    const scale = Math.max(0.1, Math.min(5, newScale));
    const worldX = (point.x - viewport.x) / oldScale;
    const worldY = (point.y - viewport.y) / oldScale;
    viewport.scale.set(scale);
    viewport.x = point.x - worldX * scale;
    viewport.y = point.y - worldY * scale;
    this.render();
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
    this.marquee.finish();
    this.drag = null;
    this.options.runtime.creationPreview = null;
    this.options.runtime.arrowPreview = null;
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

  private beginSelection(point: CanvasPoint, event: PointerEvent): void {
    const arrowHandle = this.hitArrowHandle(point);
    if (arrowHandle) {
      this.arrowInteraction.beginEdit(
        arrowHandle.arrow,
        arrowHandle.handle,
        point,
        this.options.state.objects,
      );
      this.options.engine.setCursor("grabbing");
      this.render();
      return;
    }
    const handleHit = this.objectInteraction.hitSelectionHandle(
      this.options.state.objects,
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
      this.drag = this.objectInteraction.createRotationDrag(handleHit.object, point);
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

    const object = this.objectInteraction.hitObject(this.options.state.objects, point);
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
    if (object.type === "arrow") {
      this.arrowInteraction.beginEdit(
        object as ArrowObject,
        "body",
        point,
        this.options.state.objects,
      );
      this.options.engine.setCursor("grabbing");
      this.render();
      return;
    }
    this.drag = {
      type: "object",
      objectId: object.id,
      pointerStart: { ...point },
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
    const request: CanvasTextEditRequest = {
      point: this.worldToScreen({ x: draft.x, y: draft.y }),
      initialValue: draft.text,
      initialSize: { width: draft.width, height: draft.height },
      scale: this.viewportScale,
      rotation: draft.rotation,
      caretPoint: draft.format === "markdown" ? undefined : caretPoint,
      style: {
        fontFamily: textFontFamily(draft.fontFamily),
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
    void requestText(request).then((result) => {
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
        const size =
          textObject.format === "markdown"
            ? markdownTextRenderer.measure(textObject)
            : { width: result.width, height: result.height };
        const mutated =
          previousText !== result.text ||
          textObject.width !== size.width ||
          textObject.height !== size.height;
        textObject.width = size.width;
        textObject.height = size.height;
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
      const size =
        draft.format === "markdown"
          ? markdownTextRenderer.measure(draft)
          : { width: result.width, height: result.height };
      draft.width = size.width;
      draft.height = size.height;
      this.options.state.objects.push(draft);
      this.options.selection.selectObject(draft.id);
      this.emitChange();
      this.render();
      this.focus();
    });
  }

  private beginImageInsert(point: CanvasPoint): void {
    const requestImage = this.options.requestImage;
    if (!requestImage) {
      return;
    }
    void requestImage().then((picked) => {
      if (this.disposed || !picked) {
        return;
      }
      const scale = Math.min(1, 320 / Math.max(picked.width, picked.height));
      const defaults = this.propertyDefaults.forTool("image");
      const image = new ImageObject({
        id: crypto.randomUUID(),
        type: "image",
        x: point.x,
        y: point.y,
        width: Math.max(24, picked.width * scale),
        height: Math.max(24, picked.height * scale),
        rotation: 0,
        opacity: defaults.opacity ?? 1,
        src: picked.dataUrl,
        name: picked.name,
        previewSrc: this.options.uploadImage ? picked.dataUrl : undefined,
        uploadStatus: this.options.uploadImage ? "uploading" : "ready",
        lockAspectRatio: defaults.lockAspectRatio ?? true,
        cornerRadius: defaults.cornerRadius ?? 6,
        sourceWidth: picked.width,
        sourceHeight: picked.height,
      });
      this.options.state.objects.push(image);
      this.options.selection.selectObject(image.id);
      this.emitChange();
      this.render();
      if (this.options.uploadImage) {
        void this.uploadImage(image, picked.dataUrl, picked.name);
      }
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
    if (this.options.runtime.tool === "arrow" || this.options.runtime.tool === "line") {
      this.arrowInteraction.updateHint(point, this.options.state.objects, this.viewportScale);
      const hint = this.arrowInteraction.hint();
      this.options.runtime.arrowHintObjectId = hint.objectId;
      this.options.runtime.arrowHotHint = hint.hotHint;
    }
    const object = this.objectInteraction.hitObject(this.options.state.objects, point);
    const objectId = object?.id ?? null;
    if (this.options.runtime.hoveredObjectId === objectId) {
      if (this.options.runtime.tool === "arrow" || this.options.runtime.tool === "line") {
        this.render();
      }
      return;
    }
    this.options.runtime.hoveredObjectId = objectId;

    const handleHit =
      this.options.runtime.tool === "select" || this.options.runtime.tool === "mouse"
        ? this.objectInteraction.hitSelectionHandle(
            this.options.state.objects,
            this.options.selection.objects,
            point,
            this.viewportScale,
          )
        : null;
    if (handleHit?.type === "resize") {
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
    for (let index = this.options.state.objects.length - 1; index >= 0; index--) {
      const object = this.options.state.objects[index];
      if (object.type !== "arrow" || !this.options.selection.isSelected(object.id)) continue;
      const arrow = object as ArrowObject;
      const handle = this.arrowInteraction.hitHandle(
        arrow,
        this.options.state.objects,
        point,
        this.viewportScale,
      );
      if (handle) return { arrow, handle };
    }
    return null;
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
        const size = markdownTextRenderer.measure(text);
        if (Math.abs(text.width - size.width) < 0.5 && Math.abs(text.height - size.height) < 0.5) {
          continue;
        }
        text.width = size.width;
        text.height = size.height;
        mutated = true;
      }
      if (mutated) this.emitChange();
      this.render();
    });
  }

  private emitChange(): void {
    this.panes.markDirty();
  }

  private hasActiveInteraction(): boolean {
    return Boolean(
      this.imageCrop ||
      this.creation.active ||
      this.arrowInteraction.creating ||
      this.arrowInteraction.editing ||
      this.marquee.active ||
      this.drag ||
      this.options.runtime.editingTextId,
    );
  }

  private cancelActiveInteraction(): boolean {
    if (!this.hasActiveInteraction()) return false;
    if (this.imageCrop) this.cancelImageCrop();
    this.creation.cancel();
    this.arrowInteraction.cancel();
    this.marquee.cancel(this.options.selection);
    this.restoreDrag();
    this.drag = null;
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
      case "text":
      case "markdown":
      case "image":
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
