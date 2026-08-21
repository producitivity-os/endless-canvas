import type { Container, Graphics } from "pixi.js";
import type { CanvasLink, ElementArrow } from "../model/arrow";
import type { CanvasElement } from "./elements";
import type { CanvasCard } from "../model/card";
import type { LinkHead, LinkRouting } from "./events";
import type { Point } from "./geometry";

export interface CanvasHealthStatus {
  healthy: boolean;
}

export interface CanvasBoard {
  id: string;
  name: string;

  cards: CanvasCard[];
  links: CanvasLink[];

  createdAt?: number;
  updatedAt?: number;
}


export type CanvasCardInit = {
  id: string;
  kind?: "text";
  textSizing?: "fit" | "custom";
  x: number;
  y: number;
  width: number;
  height: number;
  elements: CanvasElement[];
  arrows?: ElementArrow[];
  backgroundColor?: number;
  locked?: boolean;
};

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

export interface CanvasBoardSummary {
  id: string;
  name: string;
  createdAt?: number;
  updatedAt?: number;
}



export type CanvasBoardDocument = {
  board: CanvasBoard;
  viewport: CanvasViewport;

};



