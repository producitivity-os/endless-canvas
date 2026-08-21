import type { DragSession } from "../model/drag";
import type { Point } from "./geometry";

export type BoardDrag =
  | { type: "card"; id: string; session: DragSession }
  | { type: "pan-board"; start: Point; origin: Point }
  | { type: "draw-card"; originX: number; originY: number; currentX: number; currentY: number }
  | { type: "link-card"; fromId: string; routing: LinkRouting; current: Point }
  | { type: "bend-link"; id: string; originBend: number; start: Point }
  | { type: "rebind-link"; id: string; side: "start" | "end" }
  | {
      type: "marquee-cards";
      originX: number;
      originY: number;
      currentX: number;
      currentY: number;
      initialIds: string[];
      initialLinkIds: string[];
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

export type ResizeCorner = "topLeft" | "topRight" | "bottomRight" | "bottomLeft";

export type DetailDrag =
  | { type: "move-elements"; session: DragSession }
  | { type: "bend-element-arrow"; id: string; originBend: number; start: Point }
  | {
      type: "resize-element";
      id: string;
      corner: ResizeCorner;
      start: Point;
      origin: { x: number; y: number; width: number; height: number };
    }
  | {
      type: "rotate-element";
      id: string;
      center: Point;
      startAngle: number;
      originRotation: number;
    }
  | { type: "draw-path"; id: string }
  | { type: "draw-line"; id: string }
  | { type: "draw-element"; kind: "text" | "rect" | "ellipse"; origin: Point; current: Point }
  | { type: "draw-arrow"; fromElementId: string; current: Point }
  | { type: "select-text"; elementId: string }
  | {
      type: "crop-image";
      corner: ResizeCorner;
      start: Point;
      origin: { x: number; y: number; width: number; height: number };
    }
  | { type: "marquee"; origin: Point; current: Point }
  | { type: "pan-detail"; start: Point; origin: Point };

export type LinkRouting = "straight" | "bezier" | "orthogonal";
export type LinkHead = "none" | "triangle" | "triangle-outline" | "chicken";

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
  | "link-bezier"
  | "link-orthogonal"
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
  | "link"
  | "card"
  | "image"
  | "select"
  | "arrow"
  | "pencil"
  | "line"
  | "rect"
  | "ellipse"
  | "add";
export type CardIndexItem = { minX: number; minY: number; maxX: number; maxY: number; id: string };
export type LinkIndexItem = CardIndexItem;
export type ElementIndexItem = CardIndexItem & { z: number };
