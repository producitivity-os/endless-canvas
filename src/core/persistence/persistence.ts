import type {
  CanvasBoardDocument,
  CanvasBoardSummary,
} from "../types";

export interface CanvasPersistenceStore {
  loadBoards():
    | Promise<CanvasBoardSummary[]>
    | CanvasBoardSummary[];

  loadBoard(
    boardId: string,
  ):
    | Promise<CanvasBoardDocument>
    | CanvasBoardDocument;

  saveBoard(
    board: CanvasBoardDocument,
  ):
    | Promise<void>
    | void;

  createBoard(
    name: string,
  ):
    | Promise<CanvasBoardDocument>
    | CanvasBoardDocument;

  renameBoard(
    boardId: string,
    name: string,
  ):
    | Promise<void>
    | void;

  duplicateBoard(
    boardId: string,
  ):
    | Promise<CanvasBoardDocument>
    | CanvasBoardDocument;

  deleteBoard(
    boardId: string,
  ):
    | Promise<void>
    | void;
}

export interface CanvasPersistenceOptions {
  store: CanvasPersistenceStore;

  saveDelayMs?: number;

  getCurrentBoard:
  () => CanvasBoardDocument | null;

  onSaved?: () => void;

  onError?: (
    error: unknown,
  ) => void;
}

export class CanvasPersistence {
  private saveTimer:
    | ReturnType<typeof setTimeout>
    | null = null;

  private saving = false;
  private saveQueued = false;

  private readonly saveDelayMs: number;

  constructor(
    private readonly options:
      CanvasPersistenceOptions,
  ) {
    this.saveDelayMs =
      options.saveDelayMs ?? 300;
  }

  async loadBoards():
    Promise<CanvasBoardSummary[]> {
    return await this.options.store.loadBoards();
  }

  async loadBoard(
    boardId: string,
  ): Promise<CanvasBoardDocument> {
    return await this.options.store.loadBoard(
      boardId,
    );
  }

  async createBoard(
    name: string,
  ): Promise<CanvasBoardDocument> {
    return await this.options.store.createBoard(
      name,
    );
  }

  async renameBoard(
    boardId: string,
    name: string,
  ): Promise<void> {
    await this.options.store.renameBoard(
      boardId,
      name,
    );
  }

  async duplicateBoard(
    boardId: string,
  ): Promise<CanvasBoardDocument> {
    return await this.options.store.duplicateBoard(
      boardId,
    );
  }

  async deleteBoard(
    boardId: string,
  ): Promise<void> {
    await this.options.store.deleteBoard(
      boardId,
    );
  }

  scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(
        this.saveTimer,
      );
    }

    this.saveTimer =
      setTimeout(() => {
        this.saveTimer = null;

        void this.saveNow();
      }, this.saveDelayMs);
  }

  async saveNow(): Promise<void> {
    if (this.saving) {
      this.saveQueued = true;
      return;
    }

    const board =
      this.options.getCurrentBoard();

    if (!board) {
      return;
    }

    this.saving = true;

    try {
      await this.options.store.saveBoard(
        board,
      );

      this.options.onSaved?.();
    } catch (error) {
      this.options.onError?.(
        error,
      );
    } finally {
      this.saving = false;

      if (this.saveQueued) {
        this.saveQueued = false;

        await this.saveNow();
      }
    }
  }

  async flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(
        this.saveTimer,
      );

      this.saveTimer = null;
    }

    await this.saveNow();
  }

  cancelScheduledSave(): void {
    if (!this.saveTimer) {
      return;
    }

    clearTimeout(
      this.saveTimer,
    );

    this.saveTimer = null;
  }
}
