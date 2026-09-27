import type { CanvasLayer, CanvasObject } from "../model";

export interface CanvasHealthStatus {
  healthy: boolean;
}

export interface CanvasBoard {
  id: string;
  name: string;
}

export interface EndlessCanvasState {
  objects: CanvasObject[];
  /** Optional while reading legacy states; normalized by EndlessCanvas on initialization. */
  layers?: CanvasLayer[];
  activeLayerId?: string;
  focusedLayerId?: string | null;
  /** Opacity multiplier applied to non-focused layers. */
  unfocusedLayerOpacity?: number;
  /** Persisted root viewport. */
  viewport?: CanvasViewport;
}

export class CanvasViewport {
  x = 0;
  y = 0;
  scale = 1;
}

export type CanvasLibraryView = "all" | "recents" | "drafts";
export type CanvasIconName = "network" | "book" | "pen" | "grid";
