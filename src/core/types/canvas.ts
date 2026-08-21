import type { Container, Graphics } from "pixi.js";
import type { CanvasLink, ElementArrow } from "../model/arrow";
import type { CanvasElement } from "./elements";
import type { CanvasCard } from "../model/card";
import type { LinkHead, LinkRouting } from "./events";
import type { Point } from "./geometry";

export interface CanvasHealthStatus {
  healthy: boolean;
}

export interface EndlessCanvasState {
  cards: CanvasCard[];
  links: CanvasLink[];
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
export class CanvasViewportState {
  x = 0;
  y = 0;
  scale = 1;
}
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
