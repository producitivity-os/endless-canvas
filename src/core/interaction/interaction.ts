import type { CanvasBoardController, CanvasDetailController, CanvasHistoryController, CanvasScene, CanvasSelectionController, CanvasTextEditor } from "../runtime";
import type { Point } from "../types";


export type CanvasInteractionMode =
  | "board"
  | "detail";

export interface CanvasInteractionControllerOptions {
  scene: CanvasScene;

  board: CanvasBoardController;
  detail: CanvasDetailController;

  selection: CanvasSelectionController;
  textEditor: CanvasTextEditor;

  history: CanvasHistoryController<unknown>;

  mode(): CanvasInteractionMode;

  screenPoint(
    event: PointerEvent,
  ): Point;

  screenToBoard(
    point: Point,
  ): Point;

  screenToDetail(
    point: Point,
  ): Point;

  boardPointerDown(
    point: Point,
    event: PointerEvent,
  ): void;

  boardPointerMove(
    point: Point,
    event: PointerEvent,
  ): void;

  boardPointerUp(
    point: Point,
    event: PointerEvent,
  ): void;

  detailPointerDown(
    point: Point,
    event: PointerEvent,
  ): void;

  detailPointerMove(
    point: Point,
    event: PointerEvent,
  ): void;

  detailPointerUp(
    point: Point,
    event: PointerEvent,
  ): void;

  boardWheel?(
    event: WheelEvent,
  ): void;

  detailWheel?(
    event: WheelEvent,
  ): void;

  refresh(): void;
}

export class CanvasInteractionController {
  private pointerId:
    | number
    | null = null;

  private destroyed = false;

  private readonly options:
    CanvasInteractionControllerOptions;
  constructor(
    options: CanvasInteractionControllerOptions
  ) {
    this.options = options
  }

  attach(): void {
    const canvas =
      this.options.scene.canvas;

    canvas.addEventListener(
      "pointerdown",
      this.onPointerDown,
    );

    window.addEventListener(
      "pointermove",
      this.onPointerMove,
    );

    window.addEventListener(
      "pointerup",
      this.onPointerUp,
    );

    canvas.addEventListener(
      "wheel",
      this.onWheel,
      {
        passive: false,
      },
    );

    window.addEventListener(
      "keydown",
      this.onKeyDown,
    );
  }

  detach(): void {
    const canvas =
      this.options.scene.canvas;

    canvas.removeEventListener(
      "pointerdown",
      this.onPointerDown,
    );

    window.removeEventListener(
      "pointermove",
      this.onPointerMove,
    );

    window.removeEventListener(
      "pointerup",
      this.onPointerUp,
    );

    canvas.removeEventListener(
      "wheel",
      this.onWheel,
    );

    window.removeEventListener(
      "keydown",
      this.onKeyDown,
    );

    this.destroyed = true;
  }

  private readonly onPointerDown = (
    event: PointerEvent,
  ): void => {
    if (this.destroyed) {
      return;
    }

    this.pointerId =
      event.pointerId;

    this.options.scene.canvas
      .setPointerCapture?.(
        event.pointerId,
      );

    const screen =
      this.options.screenPoint(
        event,
      );

    if (
      this.options.mode() ===
      "detail"
    ) {
      const point =
        this.options.screenToDetail(
          screen,
        );

      this.options.detailPointerDown(
        point,
        event,
      );

      return;
    }

    const point =
      this.options.screenToBoard(
        screen,
      );

    this.options.boardPointerDown(
      point,
      event,
    );
  };

  private readonly onPointerMove = (
    event: PointerEvent,
  ): void => {
    if (
      this.destroyed ||
      (
        this.pointerId !== null &&
        event.pointerId !==
        this.pointerId
      )
    ) {
      return;
    }

    const screen =
      this.options.screenPoint(
        event,
      );

    if (
      this.options.mode() ===
      "detail"
    ) {
      this.options.detailPointerMove(
        this.options.screenToDetail(
          screen,
        ),
        event,
      );

      return;
    }

    this.options.boardPointerMove(
      this.options.screenToBoard(
        screen,
      ),
      event,
    );
  };

  private readonly onPointerUp = (
    event: PointerEvent,
  ): void => {
    if (
      this.destroyed ||
      (
        this.pointerId !== null &&
        event.pointerId !==
        this.pointerId
      )
    ) {
      return;
    }

    const screen =
      this.options.screenPoint(
        event,
      );

    if (
      this.options.mode() ===
      "detail"
    ) {
      this.options.detailPointerUp(
        this.options.screenToDetail(
          screen,
        ),
        event,
      );
    } else {
      this.options.boardPointerUp(
        this.options.screenToBoard(
          screen,
        ),
        event,
      );
    }

    this.options.scene.canvas
      .releasePointerCapture?.(
        event.pointerId,
      );

    this.pointerId = null;
  };

  private readonly onWheel = (
    event: WheelEvent,
  ): void => {
    if (this.destroyed) {
      return;
    }

    event.preventDefault();

    if (
      this.options.mode() ===
      "detail"
    ) {
      this.options.detailWheel?.(
        event,
      );

      return;
    }

    this.options.boardWheel?.(
      event,
    );
  };

  private readonly onKeyDown = (
    event: KeyboardEvent,
  ): void => {
    if (this.destroyed) {
      return;
    }

    if (
      this.options.textEditor.active
    ) {
      if (
        this.handleTextEditingKey(
          event,
        )
      ) {
        return;
      }
    }

    const modifier =
      event.metaKey ||
      event.ctrlKey;

    if (
      modifier &&
      event.key.toLowerCase() ===
      "z"
    ) {
      event.preventDefault();

      if (event.shiftKey) {
        this.options.history.redo();
      } else {
        this.options.history.undo();
      }

      return;
    }

    if (
      event.key === "Escape"
    ) {
      this.handleEscape();
      return;
    }

    if (
      event.key === "Delete" ||
      event.key === "Backspace"
    ) {
      this.handleDelete(event);
      return;
    }

    if (
      modifier &&
      event.key.toLowerCase() ===
      "a"
    ) {
      this.handleSelectAll(event);
    }
  };

  private handleEscape(): void {
    if (
      this.options.textEditor.active
    ) {
      this.options.textEditor.cancel();
      return;
    }

    if (
      this.options.mode() ===
      "detail"
    ) {
      this.options.detail.state.drag =
        null;

      this.options.selection
        .clearElements();

      this.options.selection
        .clearElementArrows();

      this.options.refresh();

      return;
    }

    this.options.board.state.drag =
      null;

    this.options.board.clearLinkMode();

    this.options.selection.clearAll();

    this.options.refresh();
  }

  private handleDelete(
    event: KeyboardEvent,
  ): void {
    event.preventDefault();

    if (
      this.options.mode() ===
      "detail"
    ) {
      this.options.detail
        .deleteSelectedElements();

      return;
    }

    // Put your existing board deletion
    // operation on CanvasBoardController.
    //
    // this.options.board.deleteSelection();
  }

  private handleSelectAll(
    event: KeyboardEvent,
  ): void {
    event.preventDefault();

    if (
      this.options.mode() ===
      "detail"
    ) {
      this.options.detail
        .selectAllElements();

      return;
    }

    // Likewise:
    //
    // this.options.board.selectAll();
  }

  private handleTextEditingKey(
    event: KeyboardEvent,
  ): boolean {
    const editor =
      this.options.textEditor;

    const modifier =
      event.metaKey ||
      event.ctrlKey;

    if (
      modifier &&
      event.key.toLowerCase() ===
      "a"
    ) {
      event.preventDefault();

      editor.selectAll();

      return true;
    }

    if (
      event.key === "Escape"
    ) {
      event.preventDefault();

      editor.cancel();

      return true;
    }

    if (
      event.key === "Enter"
    ) {
      event.preventDefault();

      editor.insert("\n");

      return true;
    }

    if (
      event.key === "Backspace"
    ) {
      event.preventDefault();

      if (
        event.altKey
      ) {
        editor.deleteWordBackward();
      } else {
        editor.deleteBackward();
      }

      return true;
    }

    if (
      event.key === "Delete"
    ) {
      event.preventDefault();

      if (
        event.altKey
      ) {
        editor.deleteWordForward();
      } else {
        editor.deleteForward();
      }

      return true;
    }

    if (
      event.key ===
      "ArrowLeft"
    ) {
      event.preventDefault();

      editor.moveCursor(
        event.altKey
          ? "word-left"
          : "left",
        event.shiftKey,
      );

      return true;
    }

    if (
      event.key ===
      "ArrowRight"
    ) {
      event.preventDefault();

      editor.moveCursor(
        event.altKey
          ? "word-right"
          : "right",
        event.shiftKey,
      );

      return true;
    }

    return false;
  }
}
