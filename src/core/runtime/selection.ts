export class CanvasSelectionState {
  readonly objects = new Set<string>();

  primaryObjectId: string | null = null;

  isSelected(id: string): boolean {
    return this.objects.has(id);
  }

  get hasSelection(): boolean {
    return this.objects.size > 0;
  }
}

export class CanvasSelectionController {
  readonly state: CanvasSelectionState;
  constructor(state: CanvasSelectionState) {
    this.state = state;
  }

  clear(): void {
    this.state.objects.clear();
    this.state.primaryObjectId = null;
  }

  selectObject(id: string, additive = false): void {
    if (!additive) {
      this.clear();
    }

    this.state.objects.add(id);
    this.state.primaryObjectId = id;
  }

  toggleObject(id: string): void {
    if (this.state.objects.has(id)) {
      this.state.objects.delete(id);

      if (this.state.primaryObjectId === id) {
        this.state.primaryObjectId = this.state.objects.values().next().value ?? null;
      }

      return;
    }

    this.state.objects.add(id);
    this.state.primaryObjectId = id;
  }

  get objects(): Set<string> {
    return this.state.objects;
  }

  get primaryObjectId(): string | null {
    return this.state.primaryObjectId;
  }

  set primaryObjectId(value: string | null) {
    this.state.primaryObjectId = value;
  }

  get hasSelection(): boolean {
    return this.state.hasSelection;
  }

  isSelected(id: string): boolean {
    return this.objects.has(id);
  }
}
