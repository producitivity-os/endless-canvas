import type { CanvasLink } from "../model/arrow";
import type { CanvasCard } from "../model/card";
import type { CanvasViewport } from "./canvas";

export interface CanvasStore {
  boardId: string;
  cards: CanvasCard[];
  links: CanvasLink[];
  viewport?: CanvasViewport;
  name: string;
}
