import type { DragSession } from "../model/drag";
import type { CanvasPoint } from "./geometry";

export type BoardDrag =
  | { type: "card"; id: string; session: DragSession }
  | { type: "pan-board"; start: CanvasPoint; origin: CanvasPoint }
  | { type: "draw-card"; originX: number; originY: number; currentX: number; currentY: number }
  | {
      type: "marquee-cards";
      originX: number;
      originY: number;
      currentX: number;
      currentY: number;
      initialIds: string[];
      additive: boolean;
    }
  | {
      type: "resize-card";
      id: string;
      handle: "topLeft" | "bottomRight";
      originX: number;
      originY: number;
      originWidth: number;
      originHeight: number;
      pointerX: number;
      pointerY: number;
    };

export type ResizeHandle =
  "left" | "right" | "top" | "bottom" | "topLeft" | "topRight" | "bottomRight" | "bottomLeft";

export type ResizeCorner = Exclude<ResizeHandle, "left" | "right">;

export type EditState = {
  cardId: string;
  elementId: string;
  value: string;
  cursor: number;
  anchor: number;
};
export type MenuAction =
  | "add-text"
  | "add-rect"
  | "add-ellipse"
  | "delete-selection"
  | "enter-detail"
  | "exit-detail"
  | "reload-canvas"
  | "select-all"
  | "edit-element"
  | "copy-element"
  | "toggle-card-lock"
  | "fit-card"
  | "card-color-menu"
  | "set-card-color";
export type CanvasTool =
  | "mouse"
  | "hand"
  | "text"
  | "markdown"
  | "card"
  | "image"
  | "select"
  | "arrow"
  | "pencil"
  | "line"
  | "rect"
  | "ellipse"
  | "diamond"
  | "pentagon"
  | "parallelogram"
  | "add";
export type CardIndexItem = { minX: number; minY: number; maxX: number; maxY: number; id: string };
export type ElementIndexItem = CardIndexItem & { z: number };
