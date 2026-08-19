import { useCallback, useRef, useSyncExternalStore } from "react";
import * as Y from "yjs";
import { saveCanvasStore } from "@/api/canvas";
import {
  cardsAsPlainData,
  cardsForStorage,
  cloneCards,
  normalizeLoadedLinks,
} from "./serialization";
import type {
  CanvasCard,
  CanvasCardInit,
  CanvasLink,
  CanvasViewport,
} from "../model";

export type CanvasSaveState = "idle" | "queued" | "saving" | "saved" | "error";

export type CanvasSelectionState = {
  primaryCardId: string;
  cardIds: readonly string[];
  linkIds: readonly string[];
  elementIds: readonly string[];
  elementArrowIds: readonly string[];
};

export type CanvasPersistenceSnapshot = {
  cards: readonly CanvasCard[];
  links: readonly CanvasLink[];
  selection: CanvasSelectionState;
  apiConnected: boolean;
  saveState: CanvasSaveState;
  boardId: string;
};

type PersistenceContext = {
  boardId: () => string;
  viewport: () => CanvasViewport;
  onSaved?: (boardId: string) => void;
  onError?: (error: unknown) => void;
};

const USER_ORIGIN = "user";
const LOAD_ORIGIN = "load";

export class CanvasPersistenceStore {
  readonly doc = new Y.Doc();
  readonly yCards = this.doc.getArray<CanvasCardInit>("cards");
  readonly yLinks = this.doc.getArray<CanvasLink>("links");
  readonly undoManager = new Y.UndoManager([this.yCards, this.yLinks], {
    trackedOrigins: new Set([USER_ORIGIN]),
  });
  readonly cards: CanvasCard[] = [];
  readonly links: CanvasLink[] = [];
  readonly primaryCard = { id: "" };
  readonly selectedCardIds = new Set<string>();
  readonly selectedLinkIds = new Set<string>();
  readonly selectedElementIds = new Set<string>();
  readonly selectedElementArrowIds = new Set<string>();

  private listeners = new Set<() => void>();
  private context: PersistenceContext | null = null;
  private saveTimer = 0;
  private queued = false;
  private apiConnected = false;
  private saveState: CanvasSaveState = "idle";
  private snapshot: CanvasPersistenceSnapshot = this.createSnapshot();
  private selectionSignature = "";

  constructor() {
    const syncRemoteChanges = (events: Y.YEvent<Y.AbstractType<unknown>>[]) => {
      const origin = events[0]?.transaction.origin;
      if (origin === USER_ORIGIN || origin === LOAD_ORIGIN) return;
      this.replaceMemoryFromY();
      this.emit();
    };
    this.yCards.observeDeep(syncRemoteChanges);
    this.yLinks.observeDeep(syncRemoteChanges);
  }

  configurePersistence(context: PersistenceContext) {
    this.context = context;
    this.emit();
  }

  hydrate(cards: CanvasCard[], links: CanvasLink[]) {
    this.cards.splice(0, this.cards.length, ...cloneCards(cards));
    this.links.splice(0, this.links.length, ...normalizeLoadedLinks(links, this.cards));
    this.doc.transact(() => {
      this.replaceYArray(this.yCards, cardsAsPlainData(this.cards));
      this.replaceYArray(this.yLinks, structuredClone(this.links));
    }, LOAD_ORIGIN);
    this.pruneSelection();
    this.emit();
  }

  commit(origin: string = USER_ORIGIN) {
    this.doc.transact(() => {
      this.replaceYArray(this.yCards, cardsAsPlainData(this.cards));
      this.replaceYArray(this.yLinks, structuredClone(this.links));
    }, origin);
    this.pruneSelection();
    this.emit();
  }

  cardsFromY() {
    return cloneCards(this.yCards.toArray());
  }

  linksFromY() {
    return normalizeLoadedLinks(structuredClone(this.yLinks.toArray()), this.cards);
  }

  undo() {
    this.undoManager.undo();
    this.replaceMemoryFromY();
    this.emit();
  }

  redo() {
    this.undoManager.redo();
    this.replaceMemoryFromY();
    this.emit();
  }

  beginUndoGroup() {
    this.undoManager.stopCapturing();
  }

  canUndo() {
    return this.undoManager.canUndo();
  }

  canRedo() {
    return this.undoManager.canRedo();
  }

  setCards(cards: CanvasCard[]) {
    this.cards.splice(0, this.cards.length, ...cloneCards(cards));
    this.pruneSelection();
    this.emit();
  }

  setLinks(links: CanvasLink[]) {
    this.links.splice(0, this.links.length, ...normalizeLoadedLinks(links, this.cards));
    this.pruneSelection();
    this.emit();
  }

  selectCards(ids: Iterable<string>) {
    const available = new Set(this.cards.map((card) => card.id));
    this.selectedCardIds.clear();
    this.selectedLinkIds.clear();
    for (const id of ids) if (available.has(id)) this.selectedCardIds.add(id);
    this.primaryCard.id = this.selectedCardIds.values().next().value ?? "";
    this.emit();
  }

  selectLinks(ids: Iterable<string>) {
    const available = new Set(this.links.map((link) => link.id));
    this.selectedCardIds.clear();
    this.primaryCard.id = "";
    this.selectedLinkIds.clear();
    for (const id of ids) if (available.has(id)) this.selectedLinkIds.add(id);
    this.emit();
  }

  selectElements(ids: Iterable<string>) {
    this.selectedElementIds.clear();
    for (const id of ids) this.selectedElementIds.add(id);
    this.emit();
  }

  selectElementArrows(ids: Iterable<string>) {
    this.selectedElementArrowIds.clear();
    for (const id of ids) this.selectedElementArrowIds.add(id);
    this.emit();
  }

  restoreSelection(selection: {
    primaryCardId?: string;
    cardIds?: Iterable<string>;
    linkIds?: Iterable<string>;
    elementIds?: Iterable<string>;
    elementArrowIds?: Iterable<string>;
  }) {
    this.selectedCardIds.clear();
    for (const id of selection.cardIds ?? []) this.selectedCardIds.add(id);
    this.selectedLinkIds.clear();
    for (const id of selection.linkIds ?? []) this.selectedLinkIds.add(id);
    this.selectedElementIds.clear();
    for (const id of selection.elementIds ?? []) this.selectedElementIds.add(id);
    this.selectedElementArrowIds.clear();
    for (const id of selection.elementArrowIds ?? []) this.selectedElementArrowIds.add(id);
    this.primaryCard.id = selection.primaryCardId ?? this.selectedCardIds.values().next().value ?? "";
    this.pruneSelection();
    this.emit();
  }

  clearSelection() {
    this.primaryCard.id = "";
    this.selectedCardIds.clear();
    this.selectedLinkIds.clear();
    this.selectedElementIds.clear();
    this.selectedElementArrowIds.clear();
    this.emit();
  }

  notifySelectionChanged() {
    this.pruneSelection();
    const signature = this.currentSelectionSignature();
    if (signature === this.selectionSignature) return;
    this.selectionSignature = signature;
    this.emit();
  }

  notifyDataChanged() {
    this.pruneSelection();
    this.emit();
  }

  setApiConnected(connected: boolean) {
    if (this.apiConnected === connected) return;
    this.apiConnected = connected;
    this.emit();
    if (connected && this.queued) this.queueSave();
  }

  isApiConnected() {
    return this.apiConnected;
  }

  hasQueuedSave() {
    return this.queued;
  }

  queueSave(delay = 450, commit = true) {
    if (commit) this.commit();
    this.queued = true;
    this.saveState = "queued";
    this.emit();
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => void this.flushSave(), delay);
  }

  async flushSave() {
    if (!this.context) return;
    window.clearTimeout(this.saveTimer);
    this.commit();
    this.queued = false;
    this.saveState = "saving";
    this.emit();
    const boardId = this.context.boardId();
    try {
      await saveCanvasStore(boardId, cardsForStorage(this.cardsFromY()), this.linksFromY(), this.context.viewport());
      this.saveState = "saved";
      this.context.onSaved?.(boardId);
    } catch (error) {
      this.queued = true;
      this.saveState = "error";
      this.context.onError?.(error);
    }
    this.emit();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  dispose() {
    window.clearTimeout(this.saveTimer);
    this.undoManager.destroy();
    this.doc.destroy();
    this.listeners.clear();
  }

  private replaceMemoryFromY() {
    this.cards.splice(0, this.cards.length, ...cloneCards(this.yCards.toArray()));
    this.links.splice(0, this.links.length, ...normalizeLoadedLinks(this.yLinks.toArray(), this.cards));
    this.pruneSelection();
  }

  private pruneSelection() {
    const cardIds = new Set(this.cards.map((card) => card.id));
    const linkIds = new Set(this.links.map((link) => link.id));
    for (const id of this.selectedCardIds) if (!cardIds.has(id)) this.selectedCardIds.delete(id);
    for (const id of this.selectedLinkIds) if (!linkIds.has(id)) this.selectedLinkIds.delete(id);
    if (!cardIds.has(this.primaryCard.id)) this.primaryCard.id = this.selectedCardIds.values().next().value ?? "";
  }

  private replaceYArray<T>(target: Y.Array<T>, values: T[]) {
    target.delete(0, target.length);
    if (values.length) target.insert(0, values);
  }

  private createSnapshot(): CanvasPersistenceSnapshot {
    return {
      cards: [...this.cards],
      links: [...this.links],
      selection: {
        primaryCardId: this.primaryCard.id,
        cardIds: [...this.selectedCardIds],
        linkIds: [...this.selectedLinkIds],
        elementIds: [...this.selectedElementIds],
        elementArrowIds: [...this.selectedElementArrowIds],
      },
      apiConnected: this.apiConnected,
      saveState: this.saveState,
      boardId: this.context?.boardId() ?? "",
    };
  }

  private currentSelectionSignature() {
    return `${this.primaryCard.id}|${[...this.selectedCardIds].join(",")}|${[...this.selectedLinkIds].join(",")}|${[...this.selectedElementIds].join(",")}|${[...this.selectedElementArrowIds].join(",")}`;
  }

  private emit() {
    this.selectionSignature = this.currentSelectionSignature();
    this.snapshot = this.createSnapshot();
    for (const listener of this.listeners) listener();
  }
}

export const canvasPersistenceStore = new CanvasPersistenceStore();

export function useCanvasPersistenceStore<T>(selector: (state: CanvasPersistenceSnapshot) => T) {
  const selectorRef = useRef(selector);
  const cacheRef = useRef<{ source: CanvasPersistenceSnapshot; selected: T } | null>(null);
  selectorRef.current = selector;
  const getSelectedSnapshot = useCallback(() => {
    const source = canvasPersistenceStore.getSnapshot();
    if (cacheRef.current?.source === source) return cacheRef.current.selected;
    const selected = selectorRef.current(source);
    if (cacheRef.current && Object.is(cacheRef.current.selected, selected)) {
      cacheRef.current = { source, selected: cacheRef.current.selected };
      return cacheRef.current.selected;
    }
    cacheRef.current = { source, selected };
    return selected;
  }, []);
  return useSyncExternalStore(
    canvasPersistenceStore.subscribe,
    getSelectedSnapshot,
    getSelectedSnapshot,
  );
}

export function useCanvasSelection() {
  const selection = useCanvasPersistenceStore((state) => state.selection);
  return {
    ...selection,
    selectCards: canvasPersistenceStore.selectCards.bind(canvasPersistenceStore),
    selectLinks: canvasPersistenceStore.selectLinks.bind(canvasPersistenceStore),
    selectElements: canvasPersistenceStore.selectElements.bind(canvasPersistenceStore),
    selectElementArrows: canvasPersistenceStore.selectElementArrows.bind(canvasPersistenceStore),
    clearSelection: canvasPersistenceStore.clearSelection.bind(canvasPersistenceStore),
  };
}

export function useCanvasCards() {
  return useCanvasPersistenceStore((state) => state.cards);
}

export function useCanvasLinks() {
  return useCanvasPersistenceStore((state) => state.links);
}

export function useCanvasApiConnected() {
  return useCanvasPersistenceStore((state) => state.apiConnected);
}

export function useCanvasSaveState() {
  return useCanvasPersistenceStore((state) => state.saveState);
}
