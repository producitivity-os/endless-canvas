import type { CanvasObject } from "../model";

export interface CanvasHealthStatus {
  healthy: boolean;
}

export interface CanvasBoard {
  id: string;
  name: string;
}

export interface EndlessCanvasState {
  objects: CanvasObject[];
}

export class CanvasViewport {
  x = 0;
  y = 0;
  scale = 1;
}

export type CanvasLibraryView = "all" | "recents" | "drafts";
export type CanvasIconName = "network" | "book" | "pen" | "grid";
