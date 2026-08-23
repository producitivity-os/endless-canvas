import type { CanvasTool } from ".";
import { CanvasSelectionState, type CanvasAssetAdapter } from "../runtime";
import type { EndlessCanvasState } from "./canvas";
import type { CanvasPoint } from "./geometry";
import type { ArrowHint, ArrowObject, CanvasImageCrop, TextFormat } from "../model";

export interface CanvasImageCropRequest {
  imageId: string;
  name?: string;
  crop: CanvasImageCrop;
}

export interface CanvasImageCropPreview {
  imageId: string;
  source: { x: number; y: number; width: number; height: number };
  frame: { x: number; y: number; width: number; height: number };
}

export interface CanvasPaneContext {
  stackLevel: number;
  readonly cardPath: readonly string[];
  canGoBack: boolean;
  maxPaneDepth: number;
}

export type CanvasPaneChangeListener = (context: CanvasPaneContext) => void;

export type EndlessCanvasOptions = {
  initialState?: EndlessCanvasState;
  onChange?: (state: EndlessCanvasState) => void;
  assets?: CanvasAssetAdapter;
  onError?: (error: unknown) => void;
  onCropRequest?: (request: CanvasImageCropRequest) => void;
  defaultTextFormat?: TextFormat;
  maxPaneDepth?: number;
  onPaneChange?: CanvasPaneChangeListener;
};

export type CanvasCreationPreview =
  | {
      type: "box";
      tool:
        | "card"
        | "text"
        | "markdown"
        | "rect"
        | "ellipse"
        | "diamond"
        | "pentagon"
        | "parallelogram";
      origin: CanvasPoint;
      current: CanvasPoint;
    }
  | {
      type: "stroke";
      tool: "pencil";
      points: CanvasPoint[];
    };

export interface CanvasArrowPreview {
  arrow: ArrowObject;
  hintObjectId: string | null;
  hotHint: ArrowHint | null;
}

export interface CanvasMarqueePreview {
  origin: CanvasPoint;
  current: CanvasPoint;
  mode: "contain" | "cross";
}

export class EndlessCanvasRuntimeState {
  hoveredObjectId: string | null = null;
  creationPreview: CanvasCreationPreview | null = null;
  arrowPreview: CanvasArrowPreview | null = null;
  arrowHintObjectId: string | null = null;
  arrowHotHint: ArrowHint | null = null;
  marquee: CanvasMarqueePreview | null = null;
  editingTextId: string | null = null;
  imageCrop: CanvasImageCropPreview | null = null;
  viewport = {
    x: 0,
    y: 0,
    scale: 1,
  };

  selection = new CanvasSelectionState();

  tool: CanvasTool = "select";
}
