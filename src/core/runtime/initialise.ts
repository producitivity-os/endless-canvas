import { CanvasPreferencesController } from "./preferences";
import { CanvasSelectionController } from "./selection";
import { CanvasHistoryController } from "./history";
import { CanvasClipboard } from "./clipboard";
import { CanvasBoardManager } from "./manager";
import { CanvasTextEditor } from "./texteditor";
import { CanvasScene } from "./scene";
import { CanvasBoardController } from "./board";
import { CanvasDetailController } from "./detail";
import type { CanvasBoardDocument, Snapshot } from "../types/canvas";
import type { EndlessCanvasRuntimeOptions } from "../types/runtime";
import { CanvasSpatialIndex, type CanvasObjectSource } from "../engine/spatial";
import { CanvasBoardRenderer, CanvasDetailRenderer, CanvasRenderer } from "../rendering/render";
import { screenToWorld } from "../engine/utils";
import { CanvasInteractionController } from "../interaction/interaction";
import { createPersistence } from "../persistence/instance";
import type { CanvasAssetAdapter } from "./asset";

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export async function initializeCanvasRuntime(
  host: HTMLElement,
  options: EndlessCanvasRuntimeOptions,
) {
  const {
    assets,
    // engine,
    document: documentState,
  } = options;


  // ---------------------------------------------------------------------------
  // Scene
  // ---------------------------------------------------------------------------

  const scene = await CanvasScene.create(host);

  // Your existing document already owns these arrays.
  const cards = documentState.cards;
  const links = documentState.links;

  const getCurrentBoard = (): CanvasBoardDocument => ({ board: { id: "board", name: "board", cards: [], links: [] }, viewport: { x: 0, y: 0, scale: 1 } })
  const persistence = createPersistence(options, scene, documentState, getCurrentBoard);
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
        boardDocument,
      ) {
        documentState.hydrate(
          boardDocument.board,
        );

        selection.clearAll();

        spatialIndex.invalidateAll();

        preferences.activate(
          boardDocument.board.id,
        );

        renderer?.render(mode);
      },

      onBoardsChanged(
        boards,
      ) {
        console.log(boards)
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

  //FIX: Fix canvasboardcontroller options
  const boardController =
    new CanvasBoardController({
      scene,
      selection,
      spatialIndex,
      source: objectSource,
      getLink(id) {

      },
      //@ts-ignore
      getTextCardElement(card) { },
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


      // openImagePicker() {
      //   ui.slots()
      //     .imageFileInput
      //     .click();
      // },
    });

  // ---------------------------------------------------------------------------
  // Detail controller
  // ---------------------------------------------------------------------------

  const detailController =
    new CanvasDetailController({
      scene,
      selection,
      spatialIndex,
      assets: assets as CanvasAssetAdapter,
      textEditor,
      captureInteractionSnapshot,
      //@ts-ignore
      textIndexAtPoint(element, point) { },

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

      //@ts-ignore
      createCardView(card) { },
      updateCardView(view, card, selected) { },
      drawLink(graphics, link, selected, hovered) { },
      drawDragPreview(graphics, drag) { }

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

      renderElement(container, element, selected) { },
      renderElementArrows(container, card) { },
      renderSelection(container, card) { },
      renderGrid(graphics, card, scale, origin) { },

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

    // ui.closeInlineEditor();
    // ui.disconnect();

    scene.destroy();
  };
}
