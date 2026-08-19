
export interface CanvasStore {
  boardId: string;
  cards: CanvasCard[];
  links: CanvasLink[];
  viewport?: CanvasViewport;
  name: string;
}
