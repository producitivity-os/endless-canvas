export interface CanvasHistoryOptions<TSnapshot> {
  capture(): TSnapshot;
  restore(snapshot: TSnapshot): void;

  maxEntries?: number;

  onChange?: () => void;
}

export class CanvasHistoryController<TSnapshot> {
  private readonly undoStack: TSnapshot[] = [];
  private readonly redoStack: TSnapshot[] = [];

  private pendingSnapshot: TSnapshot | null = null;

  private readonly maxEntries: number;

  private readonly options: CanvasHistoryOptions<TSnapshot>;
  constructor(options: CanvasHistoryOptions<TSnapshot>) {
    this.options = options;
    this.maxEntries = options.maxEntries ?? 100;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get hasPendingChange(): boolean {
    return this.pendingSnapshot !== null;
  }

  begin(): void {
    if (this.pendingSnapshot !== null) {
      return;
    }

    this.pendingSnapshot = this.options.capture();
  }

  commit(): void {
    if (this.pendingSnapshot === null) {
      return;
    }

    this.undoStack.push(this.pendingSnapshot);

    this.pendingSnapshot = null;

    this.redoStack.length = 0;

    this.trimUndoStack();

    this.options.onChange?.();
  }

  cancel(): void {
    if (this.pendingSnapshot === null) {
      return;
    }

    this.options.restore(this.pendingSnapshot);

    this.pendingSnapshot = null;

    this.options.onChange?.();
  }

  discard(): void {
    this.pendingSnapshot = null;
  }

  undo(): boolean {
    if (!this.canUndo) {
      return false;
    }

    this.pendingSnapshot = null;

    const current = this.options.capture();

    const previous = this.undoStack.pop();

    if (!previous) {
      return false;
    }

    this.redoStack.push(current);

    this.options.restore(previous);

    this.options.onChange?.();

    return true;
  }

  redo(): boolean {
    if (!this.canRedo) {
      return false;
    }

    this.pendingSnapshot = null;

    const current = this.options.capture();

    const next = this.redoStack.pop();

    if (!next) {
      return false;
    }

    this.undoStack.push(current);

    this.options.restore(next);

    this.options.onChange?.();

    return true;
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;

    this.pendingSnapshot = null;

    this.options.onChange?.();
  }

  private trimUndoStack(): void {
    while (this.undoStack.length > this.maxEntries) {
      this.undoStack.shift();
    }
  }
}
