import {
  Container,
  Graphics,
} from "pixi.js";

import type {
  CanvasElement,
  BoardDrag,
} from "../types";
import { CanvasCard, CanvasLink } from "../model";
import type { CanvasObjectSource } from "../engine";
import type { CanvasBoardController, CanvasDetailController, CanvasScene, CanvasSelectionController } from "../runtime";



export type CanvasViewMode =
  | "board"
  | "detail";

export interface CanvasBoardRendererOptions {
  scene: CanvasScene;
  objects: CanvasObjectSource;
  selection: CanvasSelectionController;
  board: CanvasBoardController;

  createCardView(
    card: CanvasCard,
  ): Container;

  updateCardView(
    view: Container,
    card: CanvasCard,
    selected: boolean,
  ): void;

  drawLink(
    graphics: Graphics,
    link: CanvasLink,
    selected: boolean,
    hovered: boolean,
  ): void;

  drawDragPreview(
    graphics: Graphics,
    drag: BoardDrag,
  ): void;
}

export class CanvasBoardRenderer {
  private readonly cardViews =
    new Map<string, Container>();


  private readonly options:
    CanvasBoardRendererOptions
  constructor(
    options: CanvasBoardRendererOptions
  ) {
    this.options = options
  }

  render(): void {
    this.syncCardViews();
    this.renderLinks();
    this.renderDrawPreview();
  }

  syncCardViews(): void {
    const activeIds = new Set<string>();

    for (const card of this.options.objects.cards()) {
      activeIds.add(card.id);

      let view =
        this.cardViews.get(card.id);

      if (!view) {
        view =
          this.options.createCardView(
            card,
          );

        this.cardViews.set(
          card.id,
          view,
        );

        this.options.scene
          .boardViewport
          .addChild(view);
      }

      this.options.updateCardView(
        view,
        card,
        this.options.selection
          .isCardSelected(card.id),
      );
    }

    for (const [
      cardId,
      view,
    ] of this.cardViews) {
      if (activeIds.has(cardId)) {
        continue;
      }

      view.destroy({
        children: true,
      });

      this.cardViews.delete(
        cardId,
      );
    }
  }

  renderLinks(): void {
    const graphics =
      this.options.scene.linkLayer;

    graphics.clear();

    for (const link of this.options.objects.links()) {
      this.options.drawLink(
        graphics,
        link,
        this.options.selection
          .isLinkSelected(link.id),
        this.options.board.state
          .hoveredLinkId === link.id,
      );
    }
  }

  renderDrawPreview(): void {
    const graphics =
      this.options.scene.drawPreview;

    graphics.clear();

    const drag =
      this.options.board.state.drag;

    if (!drag) {
      return;
    }

    this.options.drawDragPreview(
      graphics,
      drag,
    );
  }

  getCardView(
    cardId: string,
  ): Container | undefined {
    return this.cardViews.get(
      cardId,
    );
  }

  removeCardView(
    cardId: string,
  ): void {
    const view =
      this.cardViews.get(cardId);

    if (!view) {
      return;
    }

    view.destroy({
      children: true,
    });

    this.cardViews.delete(
      cardId,
    );
  }

  clear(): void {
    for (const view of this.cardViews.values()) {
      view.destroy({
        children: true,
      });
    }

    this.cardViews.clear();

    this.options.scene.linkLayer.clear();
    this.options.scene.drawPreview.clear();
  }
}

export interface CanvasDetailRendererOptions {
  scene: CanvasScene;
  detail: CanvasDetailController;
  selection: CanvasSelectionController;

  activeCard():
    | CanvasCard
    | undefined;

  renderElement(
    container: Container,
    element: CanvasElement,
    selected: boolean,
  ): void;

  renderElementArrows(
    container: Container,
    card: CanvasCard,
  ): void;

  renderSelection(
    container: Container,
    card: CanvasCard,
  ): void;

  renderGrid(
    graphics: Graphics,
    card: CanvasCard,
    scale: number,
    origin: {
      x: number;
      y: number;
    },
  ): void;
}

export class CanvasDetailRenderer {

  private readonly options:
    CanvasDetailRendererOptions;
  constructor(
    options: CanvasDetailRendererOptions
  ) {
    this.options = options
  }

  render(): void {
    const card =
      this.options.activeCard();

    if (!card) {
      this.clear();
      return;
    }

    const scene =
      this.options.scene;

    const viewport =
      this.ensureViewport();

    viewport.removeChildren();

    this.renderGrid(card);

    for (const element of card.elements) {
      this.options.renderElement(
        viewport,
        element,
        this.options.selection
          .isElementSelected(
            element.id,
          ),
      );
    }

    this.options.renderElementArrows(
      viewport,
      card,
    );

    this.options.renderSelection(
      viewport,
      card,
    );

    viewport.scale.set(
      this.options.detail.state.scale,
    );

    viewport.position.set(
      this.options.detail.state.origin.x,
      this.options.detail.state.origin.y,
    );
  }

  clear(): void {
    this.options.scene
      .detailCanvasViewport
      ?.removeChildren();

    this.options.scene
      .detailGridGraphics
      ?.clear();

    this.options.scene
      .detailLayer
      .visible = false;
  }

  private ensureViewport(): Container {
    const scene =
      this.options.scene;

    scene.detailLayer.visible =
      true;

    if (
      !scene.detailCanvasViewport
    ) {
      scene.detailCanvasViewport =
        new Container();

      scene.detailLayer.addChild(
        scene.detailCanvasViewport,
      );
    }

    if (
      !scene.detailGridGraphics
    ) {
      scene.detailGridGraphics =
        new Graphics();

      scene.detailLayer.addChildAt(
        scene.detailGridGraphics,
        0,
      );
    }

    return scene.detailCanvasViewport;
  }

  private renderGrid(
    card: CanvasCard,
  ): void {
    const graphics =
      this.options.scene
        .detailGridGraphics;

    if (!graphics) {
      return;
    }

    graphics.clear();

    this.options.renderGrid(
      graphics,
      card,
      this.options.detail.state.scale,
      this.options.detail.state.origin,
    );
  }
}

export class CanvasRenderer {

  private readonly board:
    CanvasBoardRenderer;

  private readonly detail:
    CanvasDetailRenderer;
  constructor(
    board: CanvasBoardRenderer,
    detail: CanvasDetailRenderer
  ) {
    this.board = board
    this.detail = detail
  }

  render(
    mode: CanvasViewMode,
  ): void {
    if (mode === "detail") {
      this.board.clear();
      this.detail.render();
      return;
    }

    this.detail.clear();
    this.board.render();
  }
}
