
export class CanvasSelectionState {
  readonly cards = new Set<string>();
  readonly links = new Set<string>();
  readonly elements = new Set<string>();
  readonly elementArrows = new Set<string>();

  primaryCardId: string | null = null;
  primaryLinkId: string | null = null;
  primaryElementId: string | null = null;
  primaryElementArrowId: string | null = null;
}

export class CanvasSelectionController {
  readonly state: CanvasSelectionState;
  constructor(
    state: CanvasSelectionState
  ) {
    this.state = state
  }

  clearAll(): void {
    this.clearCards();
    this.clearLinks();
    this.clearElements();
    this.clearElementArrows();
  }

  clearCards(): void {
    this.state.cards.clear();
    this.state.primaryCardId = null;
  }

  clearLinks(): void {
    this.state.links.clear();
    this.state.primaryLinkId = null;
  }

  clearElements(): void {
    this.state.elements.clear();
    this.state.primaryElementId = null;
  }

  clearElementArrows(): void {
    this.state.elementArrows.clear();
    this.state.primaryElementArrowId = null;
  }

  selectCard(
    id: string,
    additive = false,
  ): void {
    if (!additive) {



      this.clearCards();
    }

    this.state.cards.add(id);
    this.state.primaryCardId = id;
  }

  toggleCard(id: string): void {
    if (this.state.cards.has(id)) {
      this.state.cards.delete(id);

      if (
        this.state.primaryCardId === id
      ) {
        this.state.primaryCardId =
          this.state.cards
            .values()
            .next()
            .value ?? null;
      }

      return;
    }

    this.state.cards.add(id);
    this.state.primaryCardId = id;
  }

  selectLink(
    id: string,
    additive = false,
  ): void {
    if (!additive) {
      this.clearLinks();
    }

    this.state.links.add(id);
    this.state.primaryLinkId = id;
  }

  toggleLink(id: string): void {
    if (this.state.links.has(id)) {
      this.state.links.delete(id);

      if (
        this.state.primaryLinkId === id
      ) {
        this.state.primaryLinkId =
          this.state.links
            .values()
            .next()
            .value ?? null;
      }

      return;
    }

    this.state.links.add(id);
    this.state.primaryLinkId = id;
  }

  selectElement(
    id: string,
    additive = false,
  ): void {
    if (!additive) {
      this.clearElements();
    }

    this.state.elements.add(id);
    this.state.primaryElementId = id;
  }

  toggleElement(id: string): void {
    if (this.state.elements.has(id)) {
      this.state.elements.delete(id);

      if (
        this.state.primaryElementId === id
      ) {
        this.state.primaryElementId =
          this.state.elements
            .values()
            .next()
            .value ?? null;
      }

      return;
    }

    this.state.elements.add(id);
    this.state.primaryElementId = id;
  }

  selectElementArrow(
    id: string,
    additive = false,
  ): void {
    if (!additive) {
      this.clearElementArrows();
    }

    this.state.elementArrows.add(id);
    this.state.primaryElementArrowId =
      id;
  }

  toggleElementArrow(
    id: string,
  ): void {
    if (
      this.state.elementArrows.has(id)
    ) {
      this.state.elementArrows.delete(
        id,
      );

      if (
        this.state
          .primaryElementArrowId ===
        id
      ) {
        this.state.primaryElementArrowId =
          this.state.elementArrows
            .values()
            .next()
            .value ?? null;
      }

      return;
    }

    this.state.elementArrows.add(id);
    this.state.primaryElementArrowId =
      id;
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

  selectOnlyElementArrow(
    id: string,
  ): void {
    this.clearAll();
    this.selectElementArrow(id);
  }

  selectCards(
    ids: Iterable<string>,
  ): void {
    this.clearCards();

    for (const id of ids) {
      this.state.cards.add(id);

      this.state.primaryCardId ??=
        id;
    }
  }

  selectLinks(
    ids: Iterable<string>,
  ): void {
    this.clearLinks();

    for (const id of ids) {
      this.state.links.add(id);

      this.state.primaryLinkId ??=
        id;
    }
  }

  selectElements(
    ids: Iterable<string>,
  ): void {
    this.clearElements();

    for (const id of ids) {
      this.state.elements.add(id);

      this.state.primaryElementId ??=
        id;
    }
  }

  selectElementArrows(
    ids: Iterable<string>,
  ): void {
    this.clearElementArrows();

    for (const id of ids) {
      this.state.elementArrows.add(
        id,
      );

      this.state
        .primaryElementArrowId ??= id;
    }
  }

  isCardSelected(id: string): boolean {
    return this.state.cards.has(id);
  }

  isLinkSelected(id: string): boolean {
    return this.state.links.has(id);
  }

  isElementSelected(
    id: string,
  ): boolean {
    return this.state.elements.has(id);
  }

  isElementArrowSelected(
    id: string,
  ): boolean {
    return this.state.elementArrows.has(
      id,
    );
  }

  get cards(): Set<string> {
    return this.state.cards;
  }

  get links(): Set<string> {
    return this.state.links;
  }

  get elements(): Set<string> {
    return this.state.elements;
  }

  get elementArrows(): Set<string> {
    return this.state.elementArrows;
  }

  get primaryCardId():
    | string
    | null {
    return this.state.primaryCardId;
  }

  set primaryCardId(
    value: string | null,
  ) {
    this.state.primaryCardId = value;
  }

  get primaryElementId():
    | string
    | null {
    return this.state.primaryElementId;
  }

  get hasSelection(): boolean {
    return (
      this.state.cards.size > 0 ||
      this.state.links.size > 0 ||
      this.state.elements.size > 0 ||
      this.state.elementArrows.size > 0
    );
  }
}
