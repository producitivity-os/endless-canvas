import RBush from "rbush";
import type { CanvasCardObject } from "../model/card";
import type { CanvasObject } from "../model";
import type { CardIndexItem, ElementIndexItem } from "../types/events";
import { elementBounds, fitElementBounds } from "./utils";

export interface CanvasObjectSource {
  getCard(id: string): CanvasCardObject | undefined;
  cards(): Iterable<CanvasCardObject>;
}

export type Bounds = { x: number; y: number; width: number; height: number };

export class CanvasSpatialIndex {
  private readonly source: CanvasObjectSource;
  private readonly cards = new RBush<CardIndexItem>();
  private readonly cardItems = new Map<string, CardIndexItem>();
  private readonly elementTrees = new Map<string, RBush<ElementIndexItem>>();
  private readonly dirtyElements = new Set<string>();
  private cardsDirty = true;

  constructor(source: CanvasObjectSource) {
    this.source = source;
  }

  invalidateAll(): void {
    this.cardsDirty = true;
    this.elementTrees.clear();
    this.dirtyElements.clear();
  }

  getCard(id: string): CanvasCardObject | undefined {
    return this.source.getCard(id);
  }

  registerCard(cardId: string): void {
    const card = this.source.getCard(cardId);
    if (!card) return;
    this.ensureCards();
    const previous = this.cardItems.get(cardId);
    if (previous) this.cards.remove(previous);
    const item = card.indexItem();
    this.cardItems.set(cardId, item);
    this.cards.insert(item);
    this.dirtyElements.add(cardId);
  }

  updateCard(cardId: string): void {
    this.registerCard(cardId);
  }

  removeCard(cardId: string): void {
    this.ensureCards();
    const previous = this.cardItems.get(cardId);
    if (previous) this.cards.remove(previous);
    this.cardItems.delete(cardId);
    this.elementTrees.delete(cardId);
    this.dirtyElements.delete(cardId);
  }

  searchCards(bounds: Bounds): CanvasCardObject[] {
    this.ensureCards();
    return this.cards
      .search(this.rbushBounds(bounds))
      .map((item) => this.source.getCard(item.id))
      .filter((card): card is CanvasCardObject => card !== undefined);
  }

  searchElements(cardId: string, bounds: Bounds): CanvasObject[] {
    const card = this.source.getCard(cardId);
    if (!card) return [];
    return this.ensureElements(card)
      .search(this.rbushBounds(bounds))
      .sort((a, b) => a.z - b.z)
      .map((item) => card.elements[item.z])
      .filter((element): element is CanvasObject => element !== undefined);
  }

  markElementsDirty(cardId: string): void {
    this.dirtyElements.add(cardId);
  }

  private ensureCards(): void {
    if (!this.cardsDirty) return;
    this.cards.clear();
    this.cardItems.clear();
    const items = [...this.source.cards()].map((card) => card.indexItem());
    for (const item of items) this.cardItems.set(item.id, item);
    this.cards.load(items);
    this.cardsDirty = false;
  }

  private ensureElements(card: CanvasCardObject): RBush<ElementIndexItem> {
    const existing = this.elementTrees.get(card.id);
    if (existing && !this.dirtyElements.has(card.id)) return existing;
    const tree = existing ?? new RBush<ElementIndexItem>();
    tree.clear();
    tree.load(
      card.elements.map((element, z) => {
        const bounds = fitElementBounds(element) ?? elementBounds(element);
        return {
          ...this.rbushBounds(bounds),
          id: element.id,
          z,
        };
      }),
    );
    this.elementTrees.set(card.id, tree);
    this.dirtyElements.delete(card.id);
    return tree;
  }

  private rbushBounds(bounds: Bounds) {
    return {
      minX: bounds.x,
      minY: bounds.y,
      maxX: bounds.x + bounds.width,
      maxY: bounds.y + bounds.height,
    };
  }
}
