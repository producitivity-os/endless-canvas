import { canvasObjectFactory } from "../model/object-factory.ts";
import type { CanvasCardObject } from "../model/card/card.ts";
import type { CanvasObject } from "../model/object.ts";
import { expandCardToContent, fitCardToContent } from "../engine/card-content-fitter.ts";
import type {
  CanvasPaneChangeListener,
  CanvasPaneContext,
  CanvasViewport,
  EndlessCanvasState,
} from "../types";
import type { CanvasSelectionController } from "./selection.ts";

interface CanvasPaneFrame {
  card: CanvasCardObject;
  parentObjects: CanvasObject[];
  parentViewport: CanvasViewport;
  parentSelection: string[];
  parentPrimarySelection: string | null;
  dirty: boolean;
}

export interface CanvasPaneControllerOptions {
  rootState: EndlessCanvasState;
  activeState: EndlessCanvasState;
  selection: CanvasSelectionController;
  maxPaneDepth?: number;
  getViewport(): CanvasViewport;
  setViewport(viewport: CanvasViewport): void;
  centerViewport(objects: readonly CanvasObject[]): void;
  onRootChange?: () => void;
  onPaneChange?: CanvasPaneChangeListener;
  onCardCommit?: (card: CanvasCardObject) => void;
}

export function normalizeMaxPaneDepth(value: number | undefined): number {
  if (value === Infinity) return value;
  return Number.isInteger(value) && value! >= 0 ? value! : 3;
}

export class CanvasPaneController {
  private readonly options: CanvasPaneControllerOptions;
  private readonly frames: CanvasPaneFrame[] = [];
  private readonly listeners = new Set<CanvasPaneChangeListener>();
  readonly maxPaneDepth: number;

  constructor(options: CanvasPaneControllerOptions) {
    this.options = options;
    this.maxPaneDepth = normalizeMaxPaneDepth(options.maxPaneDepth);
    options.onPaneChange?.(this.context());
  }

  context(): CanvasPaneContext {
    return {
      stackLevel: this.frames.length,
      cardPath: Object.freeze(this.frames.map((frame) => frame.card.id)),
      canGoBack: this.frames.length > 0,
      maxPaneDepth: this.maxPaneDepth,
    };
  }

  subscribe(listener: CanvasPaneChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.context());
    return () => this.listeners.delete(listener);
  }

  enter(cardOrId: CanvasCardObject | string): boolean {
    if (this.frames.length >= this.maxPaneDepth) return false;
    const card = this.resolveCard(cardOrId);
    if (!card) return false;
    const viewport = this.options.getViewport();
    const selection = this.options.selection;
    this.frames.push({
      card,
      parentObjects: this.options.activeState.objects,
      parentViewport: { ...viewport },
      parentSelection: [...selection.objects],
      parentPrimarySelection: selection.primaryObjectId,
      dirty: false,
    });
    this.options.activeState.objects = this.cloneElements(card.elements);
    selection.clear();
    this.options.centerViewport(this.options.activeState.objects);
    this.notify();
    return true;
  }

  commitAndExit(): boolean {
    const frame = this.frames.at(-1);
    if (!frame) return false;
    if (frame.dirty) {
      frame.card.elements = this.options.activeState.objects;
      expandCardToContent(frame.card);
      this.options.onCardCommit?.(frame.card);
    }
    this.frames.pop();
    this.options.activeState.objects = frame.parentObjects;
    this.options.setViewport(frame.parentViewport);
    this.restoreSelection(frame);
    if (frame.dirty) {
      const parent = this.frames.at(-1);
      if (parent) parent.dirty = true;
      else this.options.onRootChange?.();
    }
    this.notify();
    return true;
  }

  markDirty(): void {
    const frame = this.frames.at(-1);
    if (frame) frame.dirty = true;
    else this.options.onRootChange?.();
  }

  fit(cardOrId: CanvasCardObject | string): boolean {
    const card = this.resolveCard(cardOrId);
    if (!card || !fitCardToContent(card)) return false;
    this.options.onCardCommit?.(card);
    this.markDirty();
    return true;
  }

  private resolveCard(cardOrId: CanvasCardObject | string): CanvasCardObject | null {
    const candidate =
      typeof cardOrId === "string"
        ? this.options.activeState.objects.find((object) => object.id === cardOrId)
        : cardOrId;
    if (!candidate || candidate.type !== "card") return null;
    if (!this.options.activeState.objects.includes(candidate)) return null;
    return candidate as CanvasCardObject;
  }

  private cloneElements(elements: readonly CanvasObject[]): CanvasObject[] {
    return structuredClone(elements).map((element) => canvasObjectFactory.hydrate(element));
  }

  private restoreSelection(frame: CanvasPaneFrame): void {
    const selection = this.options.selection;
    selection.clear();
    const validIds = new Set(frame.parentObjects.map((object) => object.id));
    for (const id of frame.parentSelection) {
      if (validIds.has(id)) selection.selectObject(id, true);
    }
    selection.primaryObjectId =
      frame.parentPrimarySelection && validIds.has(frame.parentPrimarySelection)
        ? frame.parentPrimarySelection
        : null;
  }

  private notify(): void {
    const context = this.context();
    this.options.onPaneChange?.(context);
    for (const listener of this.listeners) listener(context);
  }
}
