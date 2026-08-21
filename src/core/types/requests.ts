import type { CanvasLink } from "../model/arrow";
import type { CanvasCard } from "../model/card";
import type { CanvasViewport } from "./canvas";


export interface CreateCanvasBoardRequest {
  name: string;
}

export interface RenameCanvasBoardRequest {
  boardId: string;
  name: string;
}

export interface DeleteCanvasBoardRequest {
  boardId: string;
}

export interface SetActiveCanvasBoardRequest {
  boardId: string;
}

export interface LoadCanvasStoreRequest {
  boardId?: string;
}

export interface SaveCanvasStoreRequest {
  boardId: string;
  cards: CanvasCard[];
  links: CanvasLink[];
  viewport: CanvasViewport;
}

export interface UploadCanvasImageRequest {
  dataUrl: string;
  name: string;
}

export interface UploadedCanvasImage {
  url: string;
  name: string;
}


