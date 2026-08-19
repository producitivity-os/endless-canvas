
import type { Container, Graphics } from "pixi.js";
import type {
  CanvasCard,
  CanvasLink,
  DragSession,
  ElementArrow,
} from "./model";
import type { BaseTextElement } from "./text";



export type { CanvasCard } from "./model";
export type LinkRouting = "straight" | "bezier" | "orthogonal";
export type LinkHead = "none" | "triangle" | "triangle-outline" | "chicken";

export type LinkAppearanceInit = {
  id?: string;
  routing: LinkRouting;
  startHead?: LinkHead;
  endHead?: LinkHead;
  fromAnchor?: Point;
  toAnchor?: Point;
  bend?: number;
  strokeWidth?: number;
};

export type LinkNode = { x: number; y: number; width: number; height: number };
export type CanvasViewport = { x: number; y: number; scale: number };
export type CanvasLibraryView = "all" | "recents" | "drafts";
export type CanvasIconName = "network" | "book" | "pen" | "grid";

export type CardView = {
  root: Container;
  background: Graphics;
  content: Container;
  contentMask: Graphics;
  border: Graphics;
  topLeftHandle: Graphics;
  bottomRightHandle: Graphics;
  contentSignature?: string;
};

export type Snapshot = {
  cards: CanvasCard[];
  links: CanvasLink[];
  selectedCardId: string;
  selectedCardIds: string[];
  selectedLinkIds: string[];
  selectedElementIds: string[];
  mode: "board" | "detail";
};

export type BoardDrag =
  | { type: "card"; id: string; session: DragSession }
  | { type: "pan-board"; start: Point; origin: Point }
  | { type: "draw-card"; originX: number; originY: number; currentX: number; currentY: number }
  | { type: "link-card"; fromId: string; routing: LinkRouting; current: Point }
  | { type: "bend-link"; id: string; originBend: number; start: Point }
  | { type: "rebind-link"; id: string; side: "start" | "end" }
  | { type: "marquee-cards"; originX: number; originY: number; currentX: number; currentY: number; initialIds: string[]; initialLinkIds: string[]; additive: boolean }
  | { type: "resize-card"; id: string; handle: "topLeft" | "bottomRight"; originX: number; originY: number; originWidth: number; originHeight: number; pointerX: number; pointerY: number };

export type ResizeCorner = "topLeft" | "topRight" | "bottomRight" | "bottomLeft";

export type DetailDrag =
  | { type: "move-elements"; session: DragSession }
  | { type: "bend-element-arrow"; id: string; originBend: number; start: Point }
  | { type: "resize-element"; id: string; corner: ResizeCorner; start: Point; origin: { x: number; y: number; width: number; height: number } }
  | { type: "rotate-element"; id: string; center: Point; startAngle: number; originRotation: number }
  | { type: "draw-path"; id: string }
  | { type: "draw-line"; id: string }
  | { type: "draw-element"; kind: "text" | "rect" | "ellipse"; origin: Point; current: Point }
  | { type: "draw-arrow"; fromElementId: string; current: Point }
  | { type: "select-text"; elementId: string }
  | { type: "crop-image"; corner: ResizeCorner; start: Point; origin: { x: number; y: number; width: number; height: number } }
  | { type: "marquee"; origin: Point; current: Point }
  | { type: "pan-detail"; start: Point; origin: Point };

export type EditState = { cardId: string; elementId: string; value: string; cursor: number; anchor: number };
export type MenuAction = "add-text" | "add-rect" | "add-ellipse" | "delete-selection" | "enter-detail" | "exit-detail" | "link-bezier" | "link-orthogonal" | "reload-canvas" | "select-all" | "edit-element" | "copy-element" | "toggle-card-lock" | "fit-card" | "card-color-menu" | "set-card-color";
export type DetailTool = "select" | "hand" | "arrow" | "pencil" | "line" | "text" | "rect" | "ellipse" | "image" | "add";
export type BoardTool = "mouse" | "hand" | "text" | "link" | "card" | "image";
export type CardIndexItem = { minX: number; minY: number; maxX: number; maxY: number; id: string };
export type LinkIndexItem = CardIndexItem;
export type ElementIndexItem = CardIndexItem & { z: number };

export type CanvasBoardSummary = {
  id: string;
  name: string;
};

export type CanvasBoardDocument = {
  id: string;
  name: string;

  cards: CanvasCard[];
  links: CanvasLink[];
};



export type CanvasRuntimeDocument = {
  cards: CanvasCard[];
  links: CanvasLink[];

  primaryCard: {
    id: string;
  };

  selectedCardIds: Set<string>;
  selectedLinkIds: Set<string>;
  selectedElementIds: Set<string>;
  selectedElementArrowIds: Set<string>;

  hydrate: (
    cards: CanvasCard[],
    links: CanvasLink[],
  ) => void;

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
};

