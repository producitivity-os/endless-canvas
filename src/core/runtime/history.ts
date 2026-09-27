import type { CanvasHistoryState } from "../types/extensions.ts";

export interface CanvasHistoryOptions<TSnapshot> {
  capture(): TSnapshot;
  restore(snapshot: TSnapshot): void;
  equals?(left: TSnapshot, right: TSnapshot): boolean;
  maxEntries?: number;
  onRestore?: () => void;
  onStateChange?: (state: CanvasHistoryState) => void;
  /** @deprecated Use onStateChange. */
  onChange?: () => void;
}

export class CanvasHistoryController<TSnapshot> {
  private readonly undoStack: TSnapshot[] = [];
  private readonly redoStack: TSnapshot[] = [];
  private pendingSnapshot: TSnapshot | null = null;
  private presentSnapshot: TSnapshot;
  private readonly maxEntries: number;
  private readonly options: CanvasHistoryOptions<TSnapshot>;

  constructor(options: CanvasHistoryOptions<TSnapshot>) {
    this.options = options;
    this.maxEntries = options.maxEntries ?? 100;
    this.presentSnapshot = options.capture();
    this.notifyState();
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

  get state(): CanvasHistoryState {
    return { canUndo: this.canUndo, canRedo: this.canRedo };
  }

  begin(): void {
    this.pendingSnapshot ??= this.options.capture();
  }

  commit(): boolean {
    const before = this.pendingSnapshot;
    if (before === null) return false;
    this.pendingSnapshot = null;
    return this.recordFrom(before);
  }

  record(): boolean {
    return this.recordFrom(this.presentSnapshot);
  }

  cancel(): void {
    const snapshot = this.pendingSnapshot;
    if (snapshot === null) return;
    this.pendingSnapshot = null;
    this.presentSnapshot = snapshot;
    this.options.restore(snapshot);
    this.options.onRestore?.();
    this.notifyState();
  }

  discard(): void {
    this.pendingSnapshot = null;
  }

  undo(): boolean {
    const previous = this.undoStack.pop();
    if (!previous) return false;
    this.pendingSnapshot = null;
    this.redoStack.push(this.options.capture());
    this.presentSnapshot = previous;
    this.options.restore(previous);
    this.options.onRestore?.();
    this.notifyState();
    return true;
  }

  redo(): boolean {
    const next = this.redoStack.pop();
    if (!next) return false;
    this.pendingSnapshot = null;
    this.undoStack.push(this.options.capture());
    this.trimUndoStack();
    this.presentSnapshot = next;
    this.options.restore(next);
    this.options.onRestore?.();
    this.notifyState();
    return true;
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.pendingSnapshot = null;
    this.presentSnapshot = this.options.capture();
    this.notifyState();
  }

  private recordFrom(before: TSnapshot): boolean {
    const current = this.options.capture();
    if (this.equals(before, current)) {
      this.presentSnapshot = current;
      return false;
    }
    this.undoStack.push(before);
    this.trimUndoStack();
    this.redoStack.length = 0;
    this.presentSnapshot = current;
    this.notifyState();
    return true;
  }

  private equals(left: TSnapshot, right: TSnapshot): boolean {
    return this.options.equals?.(left, right) ?? JSON.stringify(left) === JSON.stringify(right);
  }

  private trimUndoStack(): void {
    while (this.undoStack.length > this.maxEntries) this.undoStack.shift();
  }

  private notifyState(): void {
    this.options.onStateChange?.(this.state);
    this.options.onChange?.();
  }
}
