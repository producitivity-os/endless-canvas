
import type { CanvasSelectionController } from "./selection";

import {
  type BoardRuntimeState,
  CanvasScene,
} from "./scene";
import type { CanvasElement } from "../types/elements";
import type { CanvasObjectSource, CanvasSpatialIndex } from "../engine/spatial";
import type { CanvasCard } from "../model/card";
import { CanvasLink } from "../model/arrow";
import type { BoardDrag, BoardTool, LinkHead, LinkRouting } from "../types/events";
import type { Point } from "../types/geometry";
import { DragSession, type Draggable } from "../model/drag";
import { resizeBoundsFromCorner } from "../engine/geometry";
import { minCardHeight, minCardWidth } from "../engine/utils";

type TextElement = Extract<
  CanvasElement,
  { type: "text" }
>;

type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export interface CanvasBoardControllerOptions {
  scene: CanvasScene;
  selection: CanvasSelectionController;
  spatialIndex: CanvasSpatialIndex;
  source: CanvasObjectSource;

  getCard(id: string): CanvasCard | undefined;
  getLink(id: string): CanvasLink | undefined;

  addCard(card: CanvasCard): void;
  addLink(link: CanvasLink): void;

  beginUndoGroup(): void;
  commit(): void;

  refresh(): void;
  refreshNavigation(immediate?: boolean): void;
  scheduleSave(): void;
  syncToolbar(): void;

  openImagePicker(): void;

  cardCenter(card: CanvasCard): Point;

  getTextCardElement(
    card: CanvasCard,
  ): TextElement | null;

  startBoardTextEdit(
    card: CanvasCard,
    element: TextElement,
  ): void;

  openCardDetail(cardId: string): void;

  normalizedCardAnchor(
    card: CanvasCard,
    point: Point,
  ): Point;

  hitLinkAt(
    point: Point,
  ): CanvasLink | null;

  hitSelectedLinkEndpoint(
    point: Point,
  ): {
    link: CanvasLink;
    side: "start" | "end";
  } | null;

  linkBendHandle(
    link: CanvasLink,
  ): Point | null;

  normalizeDragBounds(
    origin: Point,
    current: Point,
  ): Bounds;

  marqueeSelects(
    origin: Point,
    current: Point,
    bounds: Bounds,
  ): boolean;

  linkBounds(
    from: CanvasCard,
    to: CanvasCard,
    routing: LinkRouting,
    fromAnchor: Point,
    toAnchor: Point,
    bend?: number,
  ): Bounds;

}

export class CanvasBoardController {

  private readonly options: CanvasBoardControllerOptions;

  constructor(
    options: CanvasBoardControllerOptions,
  ) {
    this.options = options;
  }

  readonly state: BoardRuntimeState = {
    tool: "mouse",
    interactionMode: "canvas",
    drawing: false,
    drag: null,
    linkMode: null,
    hoveredLinkId: "",
    linkHoverCardId: "",
    dragMutationPending: false,
  };

  private lastTap: {
    id: string;
    time: number;
  } = {
      id: "",
      time: 0,
    };


  setDrawingMode(
    enabled: boolean,
    tool: "card" | "text" = "card",
  ): void {
    const state = this.state;

    state.drawing = enabled;

    state.linkMode = null;
    state.linkHoverCardId = "";

    state.tool = enabled
      ? tool
      : "mouse";

    if (enabled) {
      this.options.selection.clearCards();
    }

    state.drag = null;
    state.dragMutationPending = false;

    this.options.scene.clearDrawPreview();

    this.options.scene.setCursor(
      enabled
        ? "crosshair"
        : "",
    );

    this.options.syncToolbar();
    this.options.refresh();
  }

  setLinkMode(
    routing: LinkRouting,
    fromId =
      this.options.selection.selectedCardId ?? "",
    endHead: LinkHead = "triangle",
  ): void {
    const state = this.state;

    state.drawing = false;
    state.tool = "link";

    state.linkMode = {
      routing,
      fromId,

      startHead: "none",
      endHead,

      fromAnchor: {
        x: 0.5,
        y: 0.5,
      },
    };

    state.linkHoverCardId = "";

    const source =
      fromId
        ? this.options.getCard(fromId)
        : undefined;

    state.drag = source
      ? {
        type: "link-card",
        fromId,
        routing,
        current:
          this.options.cardCenter(source),
      }
      : null;

    this.options.scene.setCursor(
      "crosshair",
    );

    this.options.syncToolbar();
    this.options.refresh();
  }

  clearLinkMode(): void {
    const state = this.state;

    state.linkMode = null;
    state.linkHoverCardId = "";

    if (!state.drawing) {
      state.tool = "mouse";
    }

    if (
      state.drag?.type ===
      "link-card"
    ) {
      state.drag = null;
    }

    this.options.scene.clearCursor();

    this.options.syncToolbar();
    this.options.refresh();
  }

  setTool(
    tool: BoardTool,
  ): void {
    const state = this.state;

    state.interactionMode =
      tool === "mouse" ||
        tool === "hand"
        ? "canvas"
        : "annotate";

    if (
      tool === "mouse" ||
      tool === "hand"
    ) {
      state.drawing = false;

      state.linkMode = null;
      state.linkHoverCardId = "";

      state.tool = tool;
      state.drag = null;

      state.dragMutationPending =
        false;

      this.options.scene.clearDrawPreview();

      this.options.scene.setCursor(
        tool === "hand"
          ? "grab"
          : "",
      );

      this.options.syncToolbar();
      this.options.refreshNavigation();

      return;
    }

    if (tool === "card") {
      this.setDrawingMode(
        true,
        "card",
      );

      return;
    }

    if (tool === "text") {
      this.setDrawingMode(
        true,
        "text",
      );

      return;
    }

    if (tool === "image") {
      state.drawing = false;
      state.linkMode = null;
      state.tool = "image";

      this.options.syncToolbar();
      this.options.openImagePicker();

      return;
    }

    this.setLinkMode(
      "straight",
      "",
      "triangle",
    );
  }

  private beginCardDraw(
    point: Point,
  ): void {
    this.options.selection.clearAll();

    this.state.drag = {
      type: "draw-card",

      originX: point.x,
      originY: point.y,

      currentX: point.x,
      currentY: point.y,
    };

    this.options.scene.setCursor(
      "crosshair",
    );

    this.options.refresh();
  }

  createLink(
    fromId: string,
    toId: string,
    routing: LinkRouting,
    startHead: LinkHead,
    endHead: LinkHead,
    fromAnchor: Point = {
      x: 0.5,
      y: 0.5,
    },
    toAnchor: Point = {
      x: 0.5,
      y: 0.5,
    },
  ): void {
    if (fromId === toId) {
      return;
    }

    this.options.beginUndoGroup();

    const link = new CanvasLink({
      id: crypto.randomUUID(),

      fromId,
      toId,

      routing,

      startHead,
      endHead,

      fromAnchor,
      toAnchor,

      bend: 0,
      strokeWidth: 2.8,
    });

    this.options.addLink(link);
    this.options.spatialIndex.registerLink(link.id);

    this.options.commit();

    this.options.scheduleSave();
    this.options.refresh();
  }

  setHoveredLink(
    id: string,
  ): void {
    this.state.hoveredLinkId = id;
  }

  setLinkHoverCard(
    id: string,
  ): void {
    this.state.linkHoverCardId = id;
  }

  pointerUp(
    point: Point,
    _event: PointerEvent,
  ): void {
    const drag = this.state.drag;

    if (!drag) {
      return;
    }

    switch (drag.type) {
      case "link-card":
        this.finishLinkDrag(point);
        break;

      case "marquee-cards":
        this.applyMarqueeSelection(drag);
        break;

      case "card":
      case "resize-card":
      case "draw-card":
        if (this.state.dragMutationPending) {
          this.options.commit();
          this.options.scheduleSave();
        }
        break;

      case "pan-board":
        this.options.scheduleSave();
        break;
    }

    this.state.drag = null;
    this.state.dragMutationPending = false;

    this.options.scene.setCursor(
      this.state.tool === "hand"
        ? "grab"
        : "",
    );

    this.options.refresh();
  }
  pointerMove(
    point: Point,
    event: PointerEvent,
  ): void {
    const drag = this.state.drag;

    if (!drag) {
      return;
    }

    switch (drag.type) {
      case "card":
        drag.session.move(point);
        break;

      case "draw-card":
        drag.currentX = point.x;
        drag.currentY =
          this.state.tool === "text"
            ? drag.originY
            : point.y;
        break;

      case "link-card":
        drag.current = point;
        break;

      case "marquee-cards":
        drag.currentX = point.x;
        drag.currentY = point.y;
        this.applyMarqueeSelection(drag);
        break;

      case "resize-card":
        this.updateCardResize(
          point,
          drag,
          event.shiftKey,
        );
        break;

      case "pan-board":
        this.options.scene.boardViewport.position.set(
          drag.origin.x + point.x - drag.start.x,
          drag.origin.y + point.y - drag.start.y,
        );
        break;
    }

    this.options.refresh();
  }
  pointerDown(
    point: Point,
    event: PointerEvent,
  ): void {
    if (event.button !== 0) {
      return;
    }

    if (this.state.tool === "hand") {
      this.state.drag = {
        type: "pan-board",
        start: point,
        origin: {
          x: this.options.scene.boardViewport.x,
          y: this.options.scene.boardViewport.y,
        },
      };

      this.options.scene.setCursor("grabbing");
      return;
    }

    if (this.state.drawing) {
      this.beginCardDraw(point);
      return;
    }

    if (this.state.linkMode) {
      const card = this.hitCardAt(point);

      if (card) {
        this.beginLinkFromCard(card, point);
      } else {
        this.clearLinkMode();
      }

      return;
    }

    const resizeHit =
      this.hitSelectedCardResizeHandle(point);

    if (resizeHit) {
      this.options.selection.selectOnlyCard(
        resizeHit.card.id,
      );

      this.state.dragMutationPending = true;

      this.state.drag = {
        type: "resize-card",
        id: resizeHit.card.id,
        handle: resizeHit.handle,
        originX: resizeHit.card.x,
        originY: resizeHit.card.y,
        originWidth: resizeHit.card.width,
        originHeight: resizeHit.card.height,
        pointerX: point.x,
        pointerY: point.y,
      };

      this.options.scene.setCursor("nwse-resize");
      return;
    }

    const card = this.hitCardAt(point);

    if (card) {
      this.beginCardInteraction(
        card,
        point,
        event,
      );
      return;
    }

    const link =
      this.options.hitLinkAt(point);

    if (link) {
      if (event.shiftKey) {
        this.options.selection.toggleLink(
          link.id,
        );
      } else {
        this.options.selection.selectOnlyLink(
          link.id,
        );
      }

      this.options.refresh();
      return;
    }

    if (!event.shiftKey) {
      this.options.selection.clearCards();
      this.options.selection.clearLinks();
    }

    this.state.drag = {
      type: "marquee-cards",
      originX: point.x,
      originY: point.y,
      currentX: point.x,
      currentY: point.y,
      initialIds: [
        ...this.options.selection.cards,
      ],
      initialLinkIds: [
        ...this.options.selection.links,
      ],
      additive: event.shiftKey,
    };

    this.options.refresh();
  }


  private beginCardInteraction(
    card: CanvasCard,
    point: Point,
    event: PointerEvent,
  ): void {
    if (this.state.tool === "hand") {
      return;
    }

    if (this.state.linkMode) {
      this.beginLinkFromCard(card, point);
      return;
    }

    const wasSelected =
      this.updateCardSelection(
        card.id,
        event.shiftKey,
      );

    if (event.shiftKey) {
      return;
    }

    if (this.isDoubleTap(card.id)) {
      this.openCard(card);
      return;
    }

    this.beginCardDrag(
      card,
      point,
      wasSelected,
    );
  }
  private updateCardSelection(
    cardId: string,
    additive: boolean,
  ): boolean {
    const selection =
      this.options.selection;

    selection.clearLinks();

    const wasSelected =
      selection.isCardSelected(cardId);

    if (additive) {
      selection.toggleCard(cardId);
    } else if (!wasSelected) {
      selection.selectOnlyCard(cardId);
    } else {
      selection.primaryCardId =
        cardId;
    }

    this.options.refresh();

    return wasSelected;
  }

  private isDoubleTap(
    cardId: string,
  ): boolean {
    const now =
      performance.now();

    const doubleTap =
      this.lastTap.id === cardId &&
      now - this.lastTap.time < 340;

    this.lastTap = doubleTap
      ? {
        id: "",
        time: 0,
      }
      : {
        id: cardId,
        time: now,
      };

    return doubleTap;
  }
  private openCard(
    card: CanvasCard,
  ): void {
    this.state.drag = null;
    this.state.dragMutationPending =
      false;

    const textElement =
      this.options.getTextCardElement(
        card,
      );

    if (textElement) {
      this.options.startBoardTextEdit(
        card,
        textElement,
      );

      return;
    }

    this.options.openCardDetail(
      card.id,
    );
  }
  private beginCardDrag(
    card: CanvasCard,
    point: Point,
    wasSelected: boolean,
  ): void {
    const selection =
      this.options.selection;

    const movingIds =
      wasSelected
        ? [...selection.cards]
        : [card.id];

    const targets =
      this.createCardDragTargets(
        movingIds,
      );

    if (targets.length === 0) {
      return;
    }

    this.options.beginUndoGroup();

    this.state.dragMutationPending =
      true;

    this.state.drag = {
      type: "card",
      id: card.id,

      session: new DragSession(
        point,
        targets,
      ),
    };

    this.options.scene.setCursor(
      "move",
    );
  }
  private createCardDragTargets(
    ids: Iterable<string>,
  ): Draggable[] {
    const targets: Draggable[] = [];

    for (const id of ids) {
      const card =
        this.options.getCard(id);

      if (!card || card.locked) {
        continue;
      }

      targets.push({
        id,

        position: () => ({
          x: card.x,
          y: card.y,
        }),

        moveTo: ({ x, y }) => {
          card.x = x;
          card.y = y;

          this.options.spatialIndex
            .updateCard(card.id);
        },
      });
    }

    return targets;
  }


  private finishLinkDrag(
    point: Point,
  ): void {
    const drag = this.state.drag;

    if (
      !drag ||
      drag.type !== "link-card"
    ) {
      return;
    }

    const linkMode = this.state.linkMode;

    if (!linkMode) {
      return;
    }

    const target = this.hitCardAt(point);

    if (
      !target ||
      target.id === drag.fromId
    ) {
      return;
    }

    this.createLink(
      drag.fromId,
      target.id,
      drag.routing,
      linkMode.startHead,
      linkMode.endHead,
      linkMode.fromAnchor,
      this.options.normalizedCardAnchor(
        target,
        point,
      ),
    );

    this.clearLinkMode();
  }


  private beginLinkFromCard(
    card: CanvasCard,
    point: Point,
  ): void {
    const linkMode =
      this.state.linkMode;

    if (!linkMode) {
      return;
    }

    if (!linkMode.fromId) {
      linkMode.fromId =
        card.id;

      linkMode.fromAnchor =
        this.options.normalizedCardAnchor(
          card,
          point,
        );

      this.options.selection.selectOnlyCard(
        card.id,
      );

      this.state.drag = {
        type: "link-card",
        fromId: card.id,
        routing:
          linkMode.routing,
        current: point,
      };

      this.options.refresh();

      return;
    }

    if (
      linkMode.fromId === card.id
    ) {
      return;
    }

    this.createLink(
      linkMode.fromId,
      card.id,
      linkMode.routing,
      linkMode.startHead,
      linkMode.endHead,
      linkMode.fromAnchor,
      this.options.normalizedCardAnchor(
        card,
        point,
      ),
    );

    this.clearLinkMode();
  }





  private applyMarqueeSelection(
    drag: Extract<
      BoardDrag,
      { type: "marquee-cards" }
    >,
  ): void {
    const origin = {
      x: drag.originX,
      y: drag.originY,
    };

    const current = {
      x: drag.currentX,
      y: drag.currentY,
    };

    const bounds =
      this.options.normalizeDragBounds(
        origin,
        current,
      );

    const nextCards =
      new Set(
        drag.additive
          ? drag.initialIds
          : [],
      );

    const nextLinks =
      new Set(
        drag.additive
          ? drag.initialLinkIds
          : [],
      );

    for (
      const card of
      this.options.spatialIndex
        .searchCards(bounds)
    ) {
      const cardBounds = {
        x: card.x,
        y: card.y,
        width: card.width,
        height: card.height,
      };

      if (
        this.options.marqueeSelects(
          origin,
          current,
          cardBounds,
        )
      ) {
        nextCards.add(card.id);
      } else if (!drag.additive) {
        nextCards.delete(card.id);
      }
    }

    for (
      const link of
      this.options.spatialIndex
        .searchLinks(bounds)
    ) {
      const from =
        this.options.getCard(
          link.fromId,
        );

      const to =
        this.options.getCard(
          link.toId,
        );

      if (!from || !to) {
        continue;
      }

      const linkBox =
        this.options.linkBounds(
          from,
          to,
          link.routing,
          link.fromAnchor,
          link.toAnchor,
          link.bend,
        );

      if (
        this.options.marqueeSelects(
          origin,
          current,
          linkBox,
        )
      ) {
        nextLinks.add(link.id);
      } else if (!drag.additive) {
        nextLinks.delete(link.id);
      }
    }

    this.options.selection.selectCards(
      nextCards,
    );

    this.options.selection.clearLinks();

    for (const id of nextLinks) {
      this.options.selection.selectLink(
        id,
        true,
      );
    }
  }







  private hitCardAt(
    point: Point,
  ): CanvasCard | null {
    const hits =
      this.options.spatialIndex.searchCards({
        x: point.x,
        y: point.y,
        width: 1,
        height: 1,
      });

    if (hits.length === 0) {
      return null;
    }

    const hitIds =
      new Set(
        hits.map(
          (card) => card.id,
        ),
      );

    const cards = [
      ...this.options.source.cards(),
    ];

    for (
      let index =
        cards.length - 1;
      index >= 0;
      index--
    ) {
      if (
        hitIds.has(
          cards[index].id,
        )
      ) {
        return cards[index];
      }
    }

    return null;
  }

  private updateCardResize(
    point: Point,
    drag: Extract<
      BoardDrag,
      { type: "resize-card" }
    >,
    preserveAspectRatio = false,
  ): void {
    const card =
      this.options.getCard(drag.id);

    if (!card) {
      return;
    }

    const dx =
      point.x - drag.pointerX;

    const dy =
      point.y - drag.pointerY;

    const resizePoint =
      drag.handle === "bottomRight"
        ? {
          x:
            drag.originX +
            drag.originWidth +
            dx,

          y:
            drag.originY +
            drag.originHeight +
            dy,
        }
        : {
          x:
            drag.originX + dx,

          y:
            drag.originY + dy,
        };

    const bounds =
      resizeBoundsFromCorner(
        drag.handle,

        {
          x: drag.originX,
          y: drag.originY,
          width: drag.originWidth,
          height: drag.originHeight,
        },

        resizePoint,

        minCardWidth,
        minCardHeight,

        preserveAspectRatio,
      );

    card.x = bounds.x;
    card.y = bounds.y;
    card.width = bounds.width;
    card.height = bounds.height;

    this.options.spatialIndex.updateCard(
      card.id,
    );
  }
  private hitSelectedCardResizeHandle(
    point: Point,
  ): {
    card: CanvasCard;
    handle:
    | "topLeft"
    | "bottomRight";
  } | null {
    const scale =
      Math.max(
        0.001,
        this.options.scene
          .boardViewport.scale.x,
      );

    const tolerance =
      24 / scale;

    const cornerInset =
      8 *
      (1 - Math.SQRT1_2);

    for (
      const id of
      this.options.selection.cards
    ) {
      const card =
        this.options.getCard(id);

      if (!card || card.locked) {
        continue;
      }

      const handles = [
        {
          handle:
            "topLeft" as const,

          point: {
            x:
              card.x +
              cornerInset,

            y:
              card.y +
              cornerInset,
          },
        },

        {
          handle:
            "bottomRight" as const,

          point: {
            x:
              card.x +
              card.width -
              cornerInset,

            y:
              card.y +
              card.height -
              cornerInset,
          },
        },
      ];

      for (const handle of handles) {
        if (
          Math.hypot(
            point.x -
            handle.point.x,

            point.y -
            handle.point.y,
          ) <= tolerance
        ) {
          return {
            card,
            handle:
              handle.handle,
          };
        }
      }
    }

    return null;
  }
}
