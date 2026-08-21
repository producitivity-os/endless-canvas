import type { CanvasEngine } from "../engine";
import type { CanvasCard } from "../model";
import type { CanvasTool, EndlessCanvasRuntimeState, EndlessCanvasState, Point } from "../types";
import type { CanvasSelectionController } from "./selection";

export type CanvasDragEventType = "card" | "pan";

export type CanvasDragEvent =
  | {
      type: "card";
      cardId: string;
      pointerStart: Point;
      cardStart: Point;
    }
  | {
      type: "pan";
      pointerStart: Point;
      viewportStart: Point;
    }
  | {
      type: "draw-card";
      origin: Point;
      current: Point;
    };

export interface CanvasControllerOptions {
  engine: CanvasEngine;
  selection: CanvasSelectionController;

  state: EndlessCanvasState;
  runtime: EndlessCanvasRuntimeState;

  onChange?: () => void;
}

export class CanvasController {
  private readonly options: CanvasControllerOptions;

  private drag: CanvasDragEvent | null = null;

  constructor(options: CanvasControllerOptions) {
    this.options = options;
  }

  render(): void {
    const { engine, state } = this.options;

    engine.clearBoard();

    engine.drawGrid(engine.app.screen.width, engine.app.screen.height);

    for (const card of state.cards) {
      this.renderCard(card, this.options.selection.isCardSelected(card.id));
    }
  }

  pointerDown(point: Point, event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }

    const worldPoint = this.screenToWorld(point);

    switch (this.options.runtime.tool) {
      case "hand":
        this.beginPan(worldPoint);
        return;

      case "card":
        this.beginCardDraw(worldPoint);
        return;

      case "text":
        this.beginTextDraw(worldPoint);
        return;

      case "link":
        this.beginLink(worldPoint);
        return;

      case "image":
        this.beginImageInsert(worldPoint);
        return;

      case "select":
        break;
    }

    const card = this.hitCard(worldPoint);

    if (!card) {
      this.options.selection.clearAll();
      this.drag = null;

      this.render();
      return;
    }

    if (event.shiftKey) {
      this.options.selection.toggleCard(card.id);

      this.render();
      return;
    }

    if (!this.options.selection.isCardSelected(card.id)) {
      this.options.selection.selectOnlyCard(card.id);
    }

    this.drag = {
      type: "card",

      cardId: card.id,

      pointerStart: {
        ...worldPoint,
      },

      cardStart: {
        x: card.x,
        y: card.y,
      },
    };

    this.options.engine.setCursor("grabbing");

    this.render();
  }

  pointerMove(point: Point, _event: PointerEvent): void {
    const drag = this.drag;

    if (!drag) {
      const worldPoint = this.screenToWorld(point);

      const card = this.hitCard(worldPoint);

      this.options.engine.setCursor(card ? "grab" : "");

      return;
    }

    switch (drag.type) {
      case "pan": {
        const dx = point.x - drag.pointerStart.x;

        const dy = point.y - drag.pointerStart.y;

        this.options.engine.viewport.x = drag.viewportStart.x + dx;

        this.options.engine.viewport.y = drag.viewportStart.y + dy;

        this.render();
        return;
      }

      case "card": {
        const worldPoint = this.screenToWorld(point);

        const card = this.getCard(drag.cardId);

        if (!card) {
          this.drag = null;
          return;
        }

        const dx = worldPoint.x - drag.pointerStart.x;

        const dy = worldPoint.y - drag.pointerStart.y;

        card.x = drag.cardStart.x + dx;

        card.y = drag.cardStart.y + dy;

        this.render();
        return;
      }

      case "draw-card": {
        drag.current = this.screenToWorld(point);

        this.render();
        return;
      }
    }
  }

  pointerUp(_point: Point, _event: PointerEvent): void {
    if (!this.drag) {
      return;
    }

    this.drag = null;

    this.options.engine.setCursor("grab");

    this.options.onChange?.();

    this.render();
  }

  panBy(dx: number, dy: number): void {
    const viewport = this.options.engine.viewport;

    viewport.x += dx;
    viewport.y += dy;

    this.render();
  }

  zoomAt(point: Point, deltaY: number): void {
    const viewport = this.options.engine.viewport;
    const oldScale = viewport.scale.x;
    const zoomFactor = Math.exp(-deltaY * 0.01);
    const newScale = Math.max(0.1, Math.min(5, oldScale * zoomFactor));

    // World position under cursor before zoom.
    const worldX = (point.x - viewport.x) / oldScale;
    const worldY = (point.y - viewport.y) / oldScale;
    viewport.scale.set(newScale);

    // Reposition viewport so that the same
    // world point stays under the cursor.
    viewport.x = point.x - worldX * newScale;
    viewport.y = point.y - worldY * newScale;
    this.render();
  }

  private getCard(id: string): CanvasCard | undefined {
    return this.options.state.cards.find((card) => card.id === id);
  }

  private hitCard(point: Point): CanvasCard | null {
    const cards = this.options.state.cards;

    // Iterate backwards so the visually
    // top-most card wins.
    for (let i = cards.length - 1; i >= 0; i--) {
      const card = cards[i];

      if (
        point.x >= card.x &&
        point.x <= card.x + card.width &&
        point.y >= card.y &&
        point.y <= card.y + card.height
      ) {
        return card;
      }
    }

    return null;
  }

  private screenToWorld(point: Point): Point {
    const viewport = this.options.engine.viewport;

    const scale = viewport.scale.x;

    return {
      x: (point.x - viewport.x) / scale,

      y: (point.y - viewport.y) / scale,
    };
  }

  private renderCard(card: CanvasCard, selected: boolean): void {
    const engine = this.options.engine;

    const view = engine.createCardContainer(card);

    engine.cardLayer.addChild(view);

    for (const element of card.elements) {
      engine.drawElement(view, element);
    }

    if (selected) {
      engine.drawCardSelection(view, card);
    }
  }

  get viewportScale(): number {
    return this.options.engine.viewport.scale.x;
  }

  setZoomAt(point: Point, newScale: number): void {
    const viewport = this.options.engine.viewport;

    const oldScale = viewport.scale.x;

    newScale = Math.max(0.1, Math.min(5, newScale));

    const worldX = (point.x - viewport.x) / oldScale;

    const worldY = (point.y - viewport.y) / oldScale;

    viewport.scale.set(newScale);

    viewport.x = point.x - worldX * newScale;

    viewport.y = point.y - worldY * newScale;

    this.render();
  }

  endGesture(): void {
    this.options.onChange?.();
  }

  setTool(tool: CanvasTool): void {
    if (this.options.runtime.tool === tool) {
      return;
    }

    this.options.runtime.tool = tool;

    this.options.engine.setCursor(this.cursorForTool(tool));

    this.render();
  }

  getTool(): CanvasTool {
    return this.options.runtime.tool;
  }

  private cursorForTool(tool: CanvasTool): string {
    switch (tool) {
      case "hand":
        return "grab";

      case "card":
      case "text":
      case "link":
      case "image":
        return "crosshair";

      case "select":
      default:
        return "default";
    }
  }
  private beginPan(point: Point): void {
    this.drag = {
      type: "pan",
      pointerStart: point,

      viewportStart: {
        x: this.options.engine.viewport.x,
        y: this.options.engine.viewport.y,
      },
    };

    this.options.engine.setCursor("grabbing");
  }
  private beginCardDraw(point: Point): void {
    this.drag = {
      type: "draw-card",
      origin: point,
      current: point,
    };

    this.options.selection.clearAll();

    this.render();
  }
  private beginTextDraw(_point: Point): void {
    // later
  }

  private beginLink(_point: Point): void {
    // later
  }

  private beginImageInsert(_point: Point): void {
    // later
  }
  // pointerDown(point: Point, event: PointerEvent): void {
  // }
}
