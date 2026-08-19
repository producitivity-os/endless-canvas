import { cardsForStorage, normalizeLoadedCards, normalizeLoadedLinks } from "../store/serialization";
import { CanvasPreferencesController } from "./preferences";
import { CanvasSelectionController } from "./selection";
import { CanvasObjectSource, CanvasSpatialIndex } from "./spatial";
import { CanvasHistoryController } from "./history";
import { CanvasClipboard } from "./clipboard";
import { CanvasPersistence } from "./persistence";
import { createCanvasBoard, deleteCanvasBoard, loadCanvasBoards, loadCanvasStore, saveCanvasStore, updateCanvasBoardName } from "@/api/canvas";
import { EndlessCanvasRuntimeOptions, Snapshot } from "../types";
import { CanvasBoardManager } from "./manager";
import { CanvasTextEditor } from "./texteditor";
import { CanvasBoardRenderer, CanvasDetailRenderer, CanvasRenderer } from "./render";
import { screenToWorld } from "../engine";
import { renderElementArrows } from "../arrow";
import { CanvasInteractionController } from "./interaction";
import { CanvasScene } from "./scene";
import { CanvasBoardController } from "./board";
import { CanvasDetailController } from "./detail";



// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const createPersistence = (scene: any, documentState: any) =>
  new CanvasPersistence({
    store: {
      async loadBoards() {
        const result =
          await loadCanvasBoards();

        return result.boards;
      },

      async loadBoard(boardId) {
        const stored =
          await loadCanvasStore(
            boardId,
          );

        const loadedCards =
          normalizeLoadedCards(
            stored.cards,
          );

        const loadedLinks =
          normalizeLoadedLinks(
            stored.links,
            loadedCards,
          );

        return {
          id: boardId,
          name:
            stored.name ??
            "Untitled Canvas",
          cards: loadedCards,
          links: loadedLinks,
        };
      },

      async saveBoard(board) {
        await saveCanvasStore(
          board.id,
          cardsForStorage(
            documentState.snapshotCards(),
          ),
          documentState.snapshotLinks(),
          {
            x:
              scene.boardViewport.x,

            y:
              scene.boardViewport.y,

            scale:
              scene.boardViewport
                .scale.x,
          },
        );
      },

      async createBoard(name) {
        return createCanvasBoard(
          name,
        );
      },

      async renameBoard(
        boardId,
        name,
      ) {
        await updateCanvasBoardName(
          boardId,
          name,
        );
      },

      async duplicateBoard(
        boardId,
      ) {
        throw new Error(
          `duplicateBoard(${boardId}) not extracted yet`,
        );
      },

      async deleteBoard(
        boardId,
      ) {
        await deleteCanvasBoard(
          boardId,
        );
      },
    },

    getCurrentBoard: () => {
      const boardId =
        boardManager.currentBoardId;

      if (!boardId) {
        return null;
      }

      return {
        id: boardId,

        name:
          boardManager
            .currentBoard
            ?.name ??
          "Untitled Canvas",

        cards:
          documentState.cards,

        links:
          documentState.links,
      };
    },

    onError(error) {
      console.warn(
        "Failed to save canvas.",
        error,
      );
    },
  });

export async function initializeCanvasRuntime(
  host: HTMLElement,
  options: EndlessCanvasRuntimeOptions,
) {
  const {
    engine,
    document: documentState,
    algorithms,
    ui,
  } = options;

  const {
    keyboardShortcut,
    marqueeSelects,
    normalizeDragBounds,
  } = algorithms;

  // ---------------------------------------------------------------------------
  // Scene
  // ---------------------------------------------------------------------------

  const scene = await CanvasScene.create(host);

  // Your existing document already owns these arrays.
  const cards = documentState.cards;
  const links = documentState.links;

  const persistence = createPersistence(scene, documentState);
  // Shared object source

  const objectSource: CanvasObjectSource = {
    getCard(id) {
      return cards.find(
        (card) => card.id === id,
      );
    },

    getLink(id) {
      return links.find(
        (link) => link.id === id,
      );
    },

    cards() {
      return cards;
    },

    links() {
      return links;
    },
  };

  // Core state/controllers

  const selection =
    new CanvasSelectionController();

  const preferences =
    new CanvasPreferencesController(
      options.preferences,
    );

  const spatialIndex =
    new CanvasSpatialIndex(
      objectSource,
    );

  const clipboard =
    new CanvasClipboard();

  // Selection initialization

  selection.selectCards(
    documentState.selectedCardIds,
  );

  for (
    const id of
    documentState.selectedLinkIds
  ) {
    selection.selectLink(
      id,
      true,
    );
  }

  selection.selectElements(
    documentState.selectedElementIds,
  );

  for (
    const id of
    documentState.selectedElementArrowIds
  ) {
    selection.selectElementArrow(
      id,
      true,
    );
  }

  // Runtime mode
  let mode:
    | "board"
    | "detail" = "board";

  // Renderer is declared before some callbacks use it.
  let renderer:
    CanvasRenderer;

  // History
  const history =
    new CanvasHistoryController({
      capture: () =>
        captureInteractionSnapshot(),

      restore: (snapshot) =>
        restoreInteractionSnapshot(
          snapshot,
        ),

      onChange: () => {
        renderer?.render(mode);
      },
    });

  function captureInteractionSnapshot(): Snapshot {
    return {
      cards:
        documentState.snapshotCards(),

      links:
        documentState.snapshotLinks(),

      selectedCardId:
        selection.primaryCardId ?? "",

      selectedCardIds: [
        ...selection.cards,
      ],

      selectedLinkIds: [
        ...selection.links,
      ],

      selectedElementIds: [
        ...selection.elements,
      ],

      mode,
    };
  }

  function restoreInteractionSnapshot(
    snapshot: Snapshot,
  ): void {
    mode = snapshot.mode;

    documentState.setCards(
      snapshot.cards,
    );

    documentState.setLinks(
      snapshot.links,
    );

    documentState.restoreSelection({
      primaryCardId:
        snapshot.selectedCardId,

      cardIds:
        snapshot.selectedCardIds,

      linkIds:
        snapshot.selectedLinkIds,

      elementIds:
        snapshot.selectedElementIds,
    });

    selection.clearAll();

    selection.selectCards(
      snapshot.selectedCardIds,
    );

    for (
      const id of
      snapshot.selectedLinkIds
    ) {
      selection.selectLink(
        id,
        true,
      );
    }

    selection.selectElements(
      snapshot.selectedElementIds,
    );

    spatialIndex.invalidateAll();

    renderer?.render(mode);
  }


  // ---------------------------------------------------------------------------
  // Board manager
  // ---------------------------------------------------------------------------

  const boardManager =
    new CanvasBoardManager({
      persistence,

      onBoardChanged(
        board,
      ) {
        documentState.hydrate(
          board.cards,
          board.links,
        );

        selection.clearAll();

        spatialIndex.invalidateAll();

        preferences.activate(
          board.id,
        );

        renderer?.render(mode);
      },

      onBoardsChanged(
        boards,
      ) {
        // Wire to the existing canvas-library UI here.
      },
    });

  // ---------------------------------------------------------------------------
  // Text editor
  // ---------------------------------------------------------------------------

  const textEditor =
    new CanvasTextEditor({
      getElement(
        cardId,
        elementId,
      ) {
        return objectSource
          .getCard(cardId)
          ?.elements.find(
            (element) =>
              element.id ===
              elementId,
          );
      },

      updateElementText(
        cardId,
        elementId,
        text,
      ) {
        const card =
          objectSource.getCard(
            cardId,
          );

        const element =
          card?.elements.find(
            (element) =>
              element.id ===
              elementId,
          );

        if (
          !card ||
          element?.type !== "text"
        ) {
          return;
        }

        element.text = text;

        spatialIndex.markElementsDirty(
          cardId,
        );
      },

      beginHistory() {
        history.begin();
      },

      commitHistory() {
        history.commit();
      },

      cancelHistory() {
        history.cancel();
      },

      refresh() {
        renderer?.render(mode);
      },

      scheduleSave() {
        persistence.scheduleSave();
      },
    });

  // ---------------------------------------------------------------------------
  // Board controller
  // ---------------------------------------------------------------------------

  const boardController =
    new CanvasBoardController({
      scene,
      selection,

      getCard(id) {
        return objectSource.getCard(
          id,
        );
      },

      beginUndoGroup() {
        history.begin();
      },

      commit() {
        history.commit();
      },

      addLink(link) {
        links.push(link);
      },

      registerLink(id) {
        spatialIndex.registerLink(id);
      },

      refresh() {
        renderer?.render(mode);
      },

      refreshNavigation() {
        renderer?.render(mode);
      },

      syncToolbar() {
        // Move your existing syncToolbar()
        // implementation here.
      },

      scheduleSave() {
        persistence.scheduleSave();
      },

      cardCenter,

      openImagePicker() {
        ui.slots()
          .imageFileInput
          .click();
      },
    });

  // ---------------------------------------------------------------------------
  // Detail controller
  // ---------------------------------------------------------------------------

  const detailController =
    new CanvasDetailController({
      scene,
      selection,
      clipboard,

      activeCard() {
        const id =
          selection.primaryCardId;

        return id
          ? objectSource.getCard(id)
          : undefined;
      },

      getCard(id) {
        return objectSource.getCard(
          id,
        );
      },

      beginUndoGroup() {
        history.begin();
      },

      commit() {
        history.commit();
      },

      markElementsDirty(
        cardId,
      ) {
        spatialIndex.markElementsDirty(
          cardId,
        );
      },

      refresh() {
        renderer?.render(mode);
      },

      scheduleSave() {
        persistence.scheduleSave();
      },

      commitTextEdit() {
        textEditor.commit();
      },

      removeEmptyTextElements(
        card,
      ) {
        if (!card) {
          return;
        }

        card.elements =
          card.elements.filter(
            (element) =>
              element.type !==
              "text" ||
              element.text.length >
              0,
          );
      },

      toCardPoint(point) {
        const viewport =
          scene.detailCanvasViewport;

        if (!viewport) {
          return point;
        }

        return screenToWorld(
          viewport,
          point.x,
          point.y,
        );
      },
    });

  // ---------------------------------------------------------------------------
  // Renderers
  // ---------------------------------------------------------------------------

  const boardRenderer =
    new CanvasBoardRenderer({
      scene,
      objects: objectSource,
      selection,
      board: boardController,

      createCardView,

      updateCardView,

      drawLink,

      drawDragPreview,
    });

  const detailRenderer =
    new CanvasDetailRenderer({
      scene,
      detail:
        detailController,
      selection,

      activeCard() {
        const id =
          selection.primaryCardId;

        return id
          ? objectSource.getCard(id)
          : undefined;
      },

      renderElement,

      renderElementArrows,

      renderSelection,

      renderGrid,
    });

  // If your CanvasRenderer constructor expects TWO arguments:
  renderer =
    new CanvasRenderer(
      boardRenderer,
      detailRenderer,
    );

  // ---------------------------------------------------------------------------
  // Interactions
  // ---------------------------------------------------------------------------

  const interactions =
    new CanvasInteractionController({
      scene,
      board:
        boardController,
      detail:
        detailController,
      selection,
      textEditor,
      history,

      mode: () => mode,

      screenPoint(event) {
        const rect =
          scene.canvas
            .getBoundingClientRect();

        return {
          x:
            event.clientX -
            rect.left,

          y:
            event.clientY -
            rect.top,
        };
      },

      screenToBoard(point) {
        return screenToWorld(
          scene.boardViewport,
          point.x,
          point.y,
        );
      },

      screenToDetail(point) {
        const viewport =
          scene.detailCanvasViewport;

        if (!viewport) {
          return point;
        }

        return screenToWorld(
          viewport,
          point.x,
          point.y,
        );
      },

      boardPointerDown(
        point,
        event,
      ) {
        boardController.pointerDown(
          point,
          event,
        );
      },

      boardPointerMove(
        point,
        event,
      ) {
        boardController.pointerMove(
          point,
          event,
        );
      },

      boardPointerUp(
        point,
        event,
      ) {
        boardController.pointerUp(
          point,
          event,
        );
      },

      detailPointerDown(
        point,
        event,
      ) {
        detailController.pointerDown(
          point,
          event,
        );
      },

      detailPointerMove(
        point,
        event,
      ) {
        detailController.pointerMove(
          point,
          event,
        );
      },

      detailPointerUp(
        point,
        event,
      ) {
        detailController.pointerUp(
          point,
          event,
        );
      },

      refresh() {
        renderer.render(mode);
      },
    });

  // ---------------------------------------------------------------------------
  // Existing document synchronization
  // ---------------------------------------------------------------------------

  documentState.configureSync({
    boardId: () =>
      boardManager.currentBoardId ??
      "",

    viewport: () => ({
      x:
        scene.boardViewport.x,

      y:
        scene.boardViewport.y,

      scale:
        scene.boardViewport
          .scale.x,
    }),

    onError(error) {
      console.warn(
        "Failed to save canvas.",
        error,
      );
    },
  });

  // ---------------------------------------------------------------------------
  // Preferences
  // ---------------------------------------------------------------------------

  const unsubscribePreferences =
    options.preferences.subscribe(
      (next) => {
        preferences.set(next);

        renderer.render(mode);
      },
    );

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------

  documentState.commit(
    "load",
  );

  await boardManager.load();

  interactions.attach();

  renderer.render(mode);

  requestAnimationFrame(() => {
    scene.show();
  });

  // Keep cleanup compatible with your existing mounting API.
  return () => {
    interactions.detach();

    unsubscribePreferences();

    persistence.cancelScheduledSave();

    boardRenderer.clear();
    detailRenderer.clear();

    ui.closeInlineEditor();
    ui.disconnect();

    scene.destroy();
  };
}
