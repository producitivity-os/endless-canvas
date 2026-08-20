import type { CanvasEngine } from "../engine/utils";
import type { CanvasLink } from "../model/arrow";
import type { CanvasCard } from "../model/card";
import type { CanvasPersistenceAdapter } from "../persistence/instance";
import type { CanvasAssetAdapter } from "../runtime/asset";
import type { CanvasPreferences } from "../runtime/preferences";
import type { CanvasBoard, CanvasViewport } from "./canvas";

export type EndlessCanvasRuntimeOptions = {
  engine: CanvasEngine;
  document: CanvasRuntimeDocument;
  // algorithms: CanvasRuntimeDependencies;
  // ui: CanvasUiController;
  persistence: CanvasPersistenceAdapter;
  assets?: CanvasAssetAdapter;

  preferences: {
    current: () => CanvasPreferences;

    activateBoard: (
      boardId: string,
    ) => CanvasPreferences;

    change: (
      boardId: string,
      preferences: CanvasPreferences,
    ) => void;

    subscribe: (
      listener: (
        preferences: CanvasPreferences,
      ) => void,
    ) => () => void;
  };

  onError?: (
    message: string,
  ) => void;

};



export type CanvasRuntimeDocument = {

  board: CanvasBoard;
  cards: CanvasCard[];
  links: CanvasLink[];

  primaryCard: {
    id: string;
  };
  selectedCardIds: Set<string>;
  selectedLinkIds: Set<string>;
  selectedElementIds: Set<string>;
  selectedElementArrowIds: Set<string>;


  commit: (
    origin?: string,
  ) => void;

  snapshotCards: () => CanvasCard[];

  snapshotLinks: () => CanvasLink[];

  undo: () => void;

  redo: () => void;

  beginUndoGroup: () => void;

  canUndo: () => boolean;

  canRedo: () => boolean;

  setCards: (
    cards: CanvasCard[],
  ) => void;

  setLinks: (
    links: CanvasLink[],
  ) => void;

  selectCards: (
    ids: Iterable<string>,
  ) => void;

  selectLinks: (
    ids: Iterable<string>,
  ) => void;

  restoreSelection: (
    selection: {
      primaryCardId?: string;

      cardIds?: Iterable<string>;

      linkIds?: Iterable<string>;

      elementIds?: Iterable<string>;

      elementArrowIds?: Iterable<string>;
    },
  ) => void;

  configureSync: (
    context: {
      boardId: () => string;

      viewport: () =>
        CanvasViewport;

      onSaved?: (
        boardId: string,
      ) => void;

      onError?: (
        error: unknown,
      ) => void;
    },
  ) => void;

  scheduleSync: (
    delay?: number,
    commit?: boolean,
  ) => void;

  flushSync: () =>
    Promise<void>;


  hydrate(
    board: CanvasBoard,
  ): void;

  snapshotBoard(): CanvasBoard;

  setBoard(
    board: CanvasBoard,
  ): void;
};


