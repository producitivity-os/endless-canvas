import type { CanvasScene } from "../runtime/scene";
import { cardsForStorage, normalizeLoadedCards, normalizeLoadedLinks } from "../store";
import type { CanvasBoardsResponse, CanvasBoard, CanvasBoardDocument, CanvasRuntimeDocument, EndlessCanvasRuntimeOptions } from "../types";
import { CanvasPersistence } from "./persistence";

export interface CanvasPersistenceAdapter {
  loadBoards(): Promise<CanvasBoardsResponse>;

  loadBoard(
    boardId: string,
  ): Promise<CanvasBoardDocument>;

  saveBoard(
    document: CanvasBoardDocument,
  ): Promise<void>;

  createBoard(
    name: string,
  ): Promise<CanvasBoard>;

  renameBoard(
    boardId: string,
    name: string,
  ): Promise<CanvasBoard>;

  duplicateBoard(
    boardId: string,
  ): Promise<CanvasBoard>;

  deleteBoard(
    boardId: string,
  ): Promise<void>;

  setActiveBoard?(
    boardId: string,
  ): Promise<void>;
}

export function createPersistence(
  options: EndlessCanvasRuntimeOptions,
  scene: CanvasScene,
  documentState: CanvasRuntimeDocument,
  getCurrentBoard: () => CanvasBoardDocument | null,
) {
  return new CanvasPersistence({
    store: {
      async loadBoards() {
        const result =
          await options.persistence.loadBoards();

        return result.boards;
      },

      async loadBoard(
        boardId,
      ) {
        const boardDocument =
          await options.persistence.loadBoard(
            boardId,
          );

        return {
          ...boardDocument.board,

          cards:
            normalizeLoadedCards(
              boardDocument.board.cards,
            ),

          links:
            normalizeLoadedLinks(
              boardDocument.board.links,
              boardDocument.board.cards,
            ),
        };
      },

      async saveBoard(
        boardDocument,
      ) {
        await options.persistence.saveBoard({
          board: {
            id: boardDocument.board.id,
            name: boardDocument.board.name,
            cards: cardsForStorage(
              documentState.snapshotCards(),
            ),

            links:
              documentState.snapshotLinks(),
          },

          viewport: {
            x:
              scene.boardViewport.x,

            y:
              scene.boardViewport.y,

            scale:
              scene.boardViewport
                .scale.x,
          },
        });
      },

      createBoard(
        name,
      ) {
        return options.persistence
          .createBoard(name);
      },

      renameBoard(
        boardId,
        name,
      ) {
        return options.persistence
          .renameBoard(
            boardId,
            name,
          )
          .then(() => undefined);
      },

      duplicateBoard(
        boardId,
      ) {
        return options.persistence
          .duplicateBoard(
            boardId,
          );
      },

      deleteBoard(
        boardId,
      ) {
        return options.persistence
          .deleteBoard(
            boardId,
          );
      },
    },

    getCurrentBoard,

    onError(error) {
      console.warn(
        "Failed to persist canvas.",
        error,
      );

      options.onError?.(
        error instanceof Error
          ? error.message
          : String(error),
      );
    },
  });
}
