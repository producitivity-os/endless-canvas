import RBush from "rbush";

import type {
  CanvasCard,
  CanvasElement,
  CardIndexItem,
  ElementIndexItem,
  LinkIndexItem,
} from "../types";

import type { CanvasLink } from "../model";

import {
  elementBounds,
  fitElementBounds,
  linkBounds,
} from "../engine";

export interface CanvasObjectSource {
  getCard(id: string): CanvasCard | undefined;
  getLink(id: string): CanvasLink | undefined;

  cards(): Iterable<CanvasCard>;
  links(): Iterable<CanvasLink>;
}

export type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export class CanvasSpatialIndex {
  private readonly cardSpatialIndex =
    new RBush<CardIndexItem>();

  private readonly cardIndexItems =
    new Map<string, CardIndexItem>();

  private readonly linkSpatialIndex =
    new RBush<LinkIndexItem>();

  private readonly linkIndexItems =
    new Map<string, LinkIndexItem>();

  private readonly elementSpatialIndexes =
    new Map<string, RBush<ElementIndexItem>>();

  private readonly elementIndexItems =
    new Map<string, Map<string, ElementIndexItem>>();

  private readonly linkIdsByCardId =
    new Map<string, Set<string>>();

  private readonly dirtyElementIndexes =
    new Set<string>();

  private cardSpatialIndexDirty = true;
  private linkSpatialIndexDirty = true;

  constructor(
    private readonly objects: CanvasObjectSource,
  ) {
    this.rebuildLinkMap();
  }

  invalidateAll(): void {
    this.cardSpatialIndexDirty = true;
    this.linkSpatialIndexDirty = true;

    this.elementSpatialIndexes.clear();
    this.elementIndexItems.clear();
    this.dirtyElementIndexes.clear();

    this.rebuildLinkMap();
  }

  getCard(id: string): CanvasCard | undefined {
    return this.objects.getCard(id);
  }

  getLink(id: string): CanvasLink | undefined {
    return this.objects.getLink(id);
  }

  registerCard(cardId: string): void {
    const card = this.objects.getCard(cardId);
    if (!card) {
      return;
    }

    this.ensureCardIndex();

    const previous = this.cardIndexItems.get(cardId);

    if (previous) {
      this.cardSpatialIndex.remove(previous);
    }

    const item = card.indexItem();

    this.cardIndexItems.set(cardId, item);
    this.cardSpatialIndex.insert(item);

    this.dirtyElementIndexes.add(cardId);
    this.updateLinksForCard(cardId);
  }

  updateCard(cardId: string): void {
    this.registerCard(cardId);
  }

  removeCard(cardId: string): void {
    this.ensureCardIndex();

    const previous = this.cardIndexItems.get(cardId);

    if (previous) {
      this.cardSpatialIndex.remove(previous);
      this.cardIndexItems.delete(cardId);
    }

    this.elementSpatialIndexes.delete(cardId);
    this.elementIndexItems.delete(cardId);
    this.dirtyElementIndexes.delete(cardId);

    const linkIds =
      this.linkIdsByCardId.get(cardId) ?? [];

    for (const linkId of linkIds) {
      this.removeLinkIndexItem(linkId);
    }

    this.linkIdsByCardId.delete(cardId);
  }

  registerLink(linkId: string): void {
    const link = this.objects.getLink(linkId);
    if (!link) {
      return;
    }

    this.addLinkMapping(link);

    this.ensureLinkIndex();
    this.updateLink(linkId);
  }

  updateLink(linkId: string): void {
    this.ensureLinkIndex();

    this.removeLinkIndexItem(linkId);

    const link = this.objects.getLink(linkId);
    if (!link) {
      return;
    }

    const item = this.createLinkIndexItem(link);
    if (!item) {
      return;
    }

    this.linkIndexItems.set(linkId, item);
    this.linkSpatialIndex.insert(item);
  }

  removeLink(linkId: string): void {
    const link = this.objects.getLink(linkId);

    if (link) {
      this.removeLinkMapping(link);
    }

    this.removeLinkIndexItem(linkId);
  }

  searchCards(bounds: Bounds): CanvasCard[] {
    this.ensureCardIndex();

    return this.cardSpatialIndex
      .search(this.toRBushBounds(bounds))
      .map((item) => this.objects.getCard(item.id))
      .filter(
        (card): card is CanvasCard =>
          card !== undefined,
      );
  }

  searchLinks(bounds: Bounds): CanvasLink[] {
    this.ensureLinkIndex();

    return this.linkSpatialIndex
      .search(this.toRBushBounds(bounds))
      .map((item) => this.objects.getLink(item.id))
      .filter(
        (link): link is CanvasLink =>
          link !== undefined,
      );
  }

  searchElements(
    cardId: string,
    bounds: Bounds,
  ): CanvasElement[] {
    const card = this.objects.getCard(cardId);

    if (!card) {
      return [];
    }

    const tree = this.ensureElementIndex(card);

    return tree
      .search(this.toRBushBounds(bounds))
      .sort((a, b) => a.z - b.z)
      .map((item) => card.elements[item.z])
      .filter(
        (element): element is CanvasElement =>
          element !== undefined,
      );
  }

  markElementsDirty(cardId: string): void {
    this.dirtyElementIndexes.add(cardId);
  }

  private ensureCardIndex(): void {
    if (!this.cardSpatialIndexDirty) {
      return;
    }

    this.cardSpatialIndex.clear();
    this.cardIndexItems.clear();

    const items: CardIndexItem[] = [];

    for (const card of this.objects.cards()) {
      const item = card.indexItem();

      items.push(item);
      this.cardIndexItems.set(card.id, item);
    }

    this.cardSpatialIndex.load(items);
    this.cardSpatialIndexDirty = false;
  }

  private ensureLinkIndex(): void {
    if (!this.linkSpatialIndexDirty) {
      return;
    }

    this.ensureCardIndex();

    this.linkSpatialIndex.clear();
    this.linkIndexItems.clear();

    const items: LinkIndexItem[] = [];

    for (const link of this.objects.links()) {
      const item = this.createLinkIndexItem(link);

      if (!item) {
        continue;
      }

      items.push(item);
      this.linkIndexItems.set(link.id, item);
    }

    this.linkSpatialIndex.load(items);
    this.linkSpatialIndexDirty = false;
  }

  private ensureElementIndex(
    card: CanvasCard,
  ): RBush<ElementIndexItem> {
    const existing =
      this.elementSpatialIndexes.get(card.id);

    if (
      existing &&
      !this.dirtyElementIndexes.has(card.id)
    ) {
      return existing;
    }

    const tree =
      existing ??
      new RBush<ElementIndexItem>();

    tree.clear();

    const byId =
      new Map<string, ElementIndexItem>();

    const items = card.elements.map(
      (element, z): ElementIndexItem => {
        const bounds =
          fitElementBounds(element) ??
          elementBounds(element);

        const item: ElementIndexItem = {
          minX: bounds.x,
          minY: bounds.y,
          maxX: bounds.x + bounds.width,
          maxY: bounds.y + bounds.height,
          id: element.id,
          z,
        };

        byId.set(element.id, item);

        return item;
      },
    );

    tree.load(items);

    this.elementSpatialIndexes.set(
      card.id,
      tree,
    );

    this.elementIndexItems.set(
      card.id,
      byId,
    );

    this.dirtyElementIndexes.delete(card.id);

    return tree;
  }

  private updateLinksForCard(
    cardId: string,
  ): void {
    this.ensureLinkIndex();

    const linkIds =
      this.linkIdsByCardId.get(cardId);

    if (!linkIds) {
      return;
    }

    for (const linkId of linkIds) {
      this.updateLink(linkId);
    }
  }

  private createLinkIndexItem(
    link: CanvasLink,
  ): LinkIndexItem | null {
    const from =
      this.objects.getCard(link.fromId);

    const to =
      this.objects.getCard(link.toId);

    if (!from || !to) {
      return null;
    }

    const bounds = linkBounds(
      from,
      to,
      link.routing,
      link.fromAnchor,
      link.toAnchor,
      link.bend,
    );

    return {
      minX: bounds.x,
      minY: bounds.y,
      maxX: bounds.x + bounds.width,
      maxY: bounds.y + bounds.height,
      id: link.id,
    };
  }

  private removeLinkIndexItem(
    linkId: string,
  ): void {
    const previous =
      this.linkIndexItems.get(linkId);

    if (!previous) {
      return;
    }

    this.linkSpatialIndex.remove(previous);
    this.linkIndexItems.delete(linkId);
  }

  private rebuildLinkMap(): void {
    this.linkIdsByCardId.clear();

    for (const link of this.objects.links()) {
      this.addLinkMapping(link);
    }
  }

  private addLinkMapping(
    link: CanvasLink,
  ): void {
    for (const cardId of [
      link.fromId,
      link.toId,
    ]) {
      let linkIds =
        this.linkIdsByCardId.get(cardId);

      if (!linkIds) {
        linkIds = new Set();
        this.linkIdsByCardId.set(
          cardId,
          linkIds,
        );
      }

      linkIds.add(link.id);
    }
  }

  private removeLinkMapping(
    link: CanvasLink,
  ): void {
    for (const cardId of [
      link.fromId,
      link.toId,
    ]) {
      const linkIds =
        this.linkIdsByCardId.get(cardId);

      if (!linkIds) {
        continue;
      }

      linkIds.delete(link.id);

      if (linkIds.size === 0) {
        this.linkIdsByCardId.delete(cardId);
      }
    }
  }

  private toRBushBounds(bounds: Bounds) {
    return {
      minX: bounds.x,
      minY: bounds.y,
      maxX: bounds.x + bounds.width,
      maxY: bounds.y + bounds.height,
    };
  }
}
