export class CanvasSelection {
  readonly cards = new Set<string>();
  readonly elements = new Set<string>();

  primaryCardId: string | null = null;
  primaryElementId: string | null = null;

  clear() {
    this.cards.clear();
    this.elements.clear();
    this.primaryCardId = null;
    this.primaryElementId = null;
  }

  selectCard(id: string) {
    this.cards.add(id);
    this.primaryCardId = id;
  }
}
export class CanvasSelectionController {
  readonly cards = new Set<string>();
  readonly links = new Set<string>();
  readonly elements = new Set<string>();
  readonly elementArrows = new Set<string>();

  primaryCardId: string | null = null;
  primaryLinkId: string | null = null;
  primaryElementId: string | null = null;
  primaryElementArrowId: string | null = null;

  clearAll(): void {
    this.clearCards();
    this.clearLinks();
    this.clearElements();
    this.clearElementArrows();
  }

  clearCards(): void {
    this.cards.clear();
    this.primaryCardId = null;
  }

  clearLinks(): void {
    this.links.clear();
    this.primaryLinkId = null;
  }

  clearElements(): void {
    this.elements.clear();
    this.primaryElementId = null;
  }

  clearElementArrows(): void {
    this.elementArrows.clear();
    this.primaryElementArrowId = null;
  }

  selectCard(
    id: string,
    additive = false,
  ): void {
    if (!additive) {
      this.clearCards();
    }

    this.cards.add(id);
    this.primaryCardId = id;
  }

  toggleCard(id: string): void {
    if (this.cards.has(id)) {
      this.cards.delete(id);

      if (this.primaryCardId === id) {
        this.primaryCardId =
          this.cards.values().next().value ?? null;
      }

      return;
    }

    this.cards.add(id);
    this.primaryCardId = id;
  }

  selectLink(
    id: string,
    additive = false,
  ): void {
    if (!additive) {
      this.clearLinks();
    }

    this.links.add(id);
    this.primaryLinkId = id;
  }

  toggleLink(id: string): void {
    if (this.links.has(id)) {
      this.links.delete(id);

      if (this.primaryLinkId === id) {
        this.primaryLinkId =
          this.links.values().next().value ?? null;
      }

      return;
    }

    this.links.add(id);
    this.primaryLinkId = id;
  }

  selectElement(
    id: string,
    additive = false,
  ): void {
    if (!additive) {
      this.clearElements();
    }

    this.elements.add(id);
    this.primaryElementId = id;
  }

  toggleElement(id: string): void {
    if (this.elements.has(id)) {
      this.elements.delete(id);

      if (this.primaryElementId === id) {
        this.primaryElementId =
          this.elements.values().next().value ?? null;
      }

      return;
    }

    this.elements.add(id);
    this.primaryElementId = id;
  }

  selectElementArrow(
    id: string,
    additive = false,
  ): void {
    if (!additive) {
      this.clearElementArrows();
    }

    this.elementArrows.add(id);
    this.primaryElementArrowId = id;
  }

  toggleElementArrow(id: string): void {
    if (this.elementArrows.has(id)) {
      this.elementArrows.delete(id);

      if (this.primaryElementArrowId === id) {
        this.primaryElementArrowId =
          this.elementArrows.values().next().value ?? null;
      }

      return;
    }

    this.elementArrows.add(id);
    this.primaryElementArrowId = id;
  }

  selectOnlyCard(id: string): void {
    this.clearAll();
    this.selectCard(id);
  }

  selectOnlyLink(id: string): void {
    this.clearAll();
    this.selectLink(id);
  }

  selectOnlyElement(id: string): void {
    this.clearAll();
    this.selectElement(id);
  }

  selectOnlyElementArrow(id: string): void {
    this.clearAll();
    this.selectElementArrow(id);
  }

  selectCards(ids: Iterable<string>): void {
    this.clearCards();

    for (const id of ids) {
      this.cards.add(id);
      this.primaryCardId ??= id;
    }
  }

  selectElements(ids: Iterable<string>): void {
    this.clearElements();

    for (const id of ids) {
      this.elements.add(id);
      this.primaryElementId ??= id;
    }
  }

  isCardSelected(id: string): boolean {
    return this.cards.has(id);
  }

  isLinkSelected(id: string): boolean {
    return this.links.has(id);
  }

  isElementSelected(id: string): boolean {
    return this.elements.has(id);
  }

  isElementArrowSelected(id: string): boolean {
    return this.elementArrows.has(id);
  }

  get hasCardSelection(): boolean {
    return this.cards.size > 0;
  }

  get hasLinkSelection(): boolean {
    return this.links.size > 0;
  }

  get hasElementSelection(): boolean {
    return this.elements.size > 0;
  }

  get hasElementArrowSelection(): boolean {
    return this.elementArrows.size > 0;
  }

  get hasSelection(): boolean {
    return (
      this.hasCardSelection ||
      this.hasLinkSelection ||
      this.hasElementSelection ||
      this.hasElementArrowSelection
    );
  }

  get selectedCardId(): string | null {
    return this.primaryCardId;
  }

  get selectedElementId(): string | null {
    return this.primaryElementId;
  }
}
