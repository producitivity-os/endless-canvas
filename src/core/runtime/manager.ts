
import type {
  CanvasBoardSummary,
  CanvasBoardDocument,
} from "../types";
import { CanvasPersistence } from "./persistence";

export interface CanvasBoardManagerOptions {
  persistence: CanvasPersistence;

  onBoardChanged?: (
    board: CanvasBoardDocument,
  ) => void;

  onBoardsChanged?: (
    boards: CanvasBoardSummary[],
  ) => void;
}

export class CanvasBoardManager {
  private boards: CanvasBoardSummary[] = [];

  private activeBoardId: string | null = null;

  constructor(
    private readonly options: CanvasBoardManagerOptions,
  ) { }

  get currentBoardId(): string | null {
    return this.activeBoardId;
  }

  get allBoards(): readonly CanvasBoardSummary[] {
    return this.boards;
  }

  get currentBoard():
    | CanvasBoardSummary
    | undefined {
    if (!this.activeBoardId) {
      return undefined;
    }

    return this.boards.find(
      (board) =>
        board.id === this.activeBoardId,
    );
  }

  async load(): Promise<void> {
    this.boards =
      await this.options.persistence.loadBoards();

    this.options.onBoardsChanged?.(
      this.boards,
    );

    if (
      !this.activeBoardId &&
      this.boards.length > 0
    ) {
      await this.activate(
        this.boards[0].id,
      );
    }
  }

  async activate(
    boardId: string,
  ): Promise<CanvasBoardDocument> {
    const board =
      await this.options.persistence.loadBoard(
        boardId,
      );

    this.activeBoardId = boardId;

    this.options.onBoardChanged?.(
      board,
    );

    return board;
  }

  async create(
    name = "Untitled Canvas",
  ): Promise<CanvasBoardDocument> {
    const board =
      await this.options.persistence.createBoard(
        name,
      );

    this.boards.push({
      id: board.id,
      name: board.name,
    });

    this.activeBoardId = board.id;

    this.options.onBoardsChanged?.(
      this.boards,
    );

    this.options.onBoardChanged?.(
      board,
    );

    return board;
  }

  async rename(
    boardId: string,
    name: string,
  ): Promise<void> {
    await this.options.persistence.renameBoard(
      boardId,
      name,
    );

    const board =
      this.boards.find(
        (candidate) =>
          candidate.id === boardId,
      );

    if (board) {
      board.name = name;
    }

    this.options.onBoardsChanged?.(
      this.boards,
    );
  }

  async duplicate(
    boardId: string,
  ): Promise<CanvasBoardDocument> {
    const duplicate =
      await this.options.persistence.duplicateBoard(
        boardId,
      );

    this.boards.push({
      id: duplicate.id,
      name: duplicate.name,
    });

    this.activeBoardId =
      duplicate.id;

    this.options.onBoardsChanged?.(
      this.boards,
    );

    this.options.onBoardChanged?.(
      duplicate,
    );

    return duplicate;
  }

  async remove(
    boardId: string,
  ): Promise<void> {
    await this.options.persistence.deleteBoard(
      boardId,
    );

    this.boards =
      this.boards.filter(
        (board) =>
          board.id !== boardId,
      );

    if (
      this.activeBoardId === boardId
    ) {
      const next =
        this.boards[0];

      this.activeBoardId =
        next?.id ?? null;

      if (next) {
        await this.activate(next.id);
      }
    }

    this.options.onBoardsChanged?.(
      this.boards,
    );
  }
}
