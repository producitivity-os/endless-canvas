import type { CanvasCardObject } from "../model/card";
import type { CanvasViewport } from "./canvas";

export interface CanvasStore {
  boardId: string;
  cards: CanvasCardObject[];
  viewport?: CanvasViewport;
  name: string;
}
