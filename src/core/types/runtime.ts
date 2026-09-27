import type { CanvasTool } from ".";
import type { CanvasAssetAdapter } from "../runtime/asset.ts";
import { CanvasSelectionState } from "../runtime/selection.ts";
import type { EndlessCanvasState } from "./canvas";
import type { CanvasPoint } from "./geometry";
import type {
  ArrowHint,
  ArrowObject,
  CanvasCardObject,
  CanvasImageCrop,
  CanvasObjectCapabilityDefaults,
  CanvasPluginCardProvider,
  CardTemplateProvider,
  TextFormat,
} from "../model";
import type { CanvasPropertyDefaultsByTool, CanvasPropertyPatch } from "../properties/types";
import type { CanvasSystemClipboard } from "../runtime/clipboard";
import type {
  CanvasConnectionDropHandler,
  CanvasObjectExtension,
  CanvasHistoryState,
  CanvasSelectionChange,
} from "./extensions.ts";
import type { CanvasObject } from "../model/object.ts";
import type { CanvasGridStyle } from "../model/canvas.ts";

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

export interface CanvasObjectClickContext {
  regionId?: string;
}

export type CanvasExternalImagePasteInput = {
  dataUrl: string;
  mimeType: string;
  name: string;
  width: number;
  height: number;
  point: CanvasPoint;
  layerId: string;
};

export type CanvasExternalImagePasteFactory = (
  input: CanvasExternalImagePasteInput,
  pane: CanvasPaneContext,
) => CanvasObject | null | Promise<CanvasObject | null>;

export interface CanvasDrawnPlacement {
  origin: CanvasPoint;
  endpoint: CanvasPoint;
  bounds: { x: number; y: number; width: number; height: number };
  center: CanvasPoint;
  dragged: boolean;
}

export function canvasDrawnPlacement(
  origin: CanvasPoint,
  endpoint: CanvasPoint,
): CanvasDrawnPlacement {
  const width = Math.abs(endpoint.x - origin.x);
  const height = Math.abs(endpoint.y - origin.y);
  const x = Math.min(origin.x, endpoint.x);
  const y = Math.min(origin.y, endpoint.y);
  return {
    origin: { ...origin },
    endpoint: { ...endpoint },
    bounds: { x, y, width, height },
    center: {
      x: width >= 2 ? x + width / 2 : origin.x,
      y: height >= 2 ? y + height / 2 : origin.y,
    },
    dragged: width >= 2 || height >= 2,
  };
}

export type EndlessCanvasOptions = {
  initialState?: EndlessCanvasState;
  onChange?: (state: EndlessCanvasState) => void;
  assets?: CanvasAssetAdapter;
  onError?: (error: unknown) => void;
  onCropRequest?: (request: CanvasImageCropRequest) => void;
  defaultTextFormat?: TextFormat;
  maxPaneDepth?: number;
  onPaneChange?: CanvasPaneChangeListener;
  clipboard?: CanvasSystemClipboard;
  objectCapabilities?: CanvasObjectCapabilityDefaults;
  propertyDefaults?: CanvasPropertyDefaultsByTool;
  /** Visual grid treatment for this canvas surface. */
  gridStyle?: CanvasGridStyle;
  objectExtensions?: readonly CanvasObjectExtension<any>[];
  onConnectionDrop?: CanvasConnectionDropHandler;
  onAddToolPlacement?: (point: CanvasPoint) => CanvasObject | null;
  onAddToolDraw?: (placement: CanvasDrawnPlacement) => CanvasObject | null;
  onExternalImagePaste?: CanvasExternalImagePasteFactory;
  resolveArrowDefaults?: (
    tool: "arrow" | "line",
    pane: CanvasPaneContext,
  ) => CanvasPropertyPatch | undefined;
  onObjectActivate?: (object: CanvasObject) => void;
  onObjectClick?: (object: CanvasObject, context: CanvasObjectClickContext) => void;
  shouldEnterCardPane?: (card: CanvasCardObject) => boolean;
  canInsertObject?: (object: CanvasObject, pane: CanvasPaneContext) => boolean;
  onObjectCreate?: (object: CanvasObject, pane: CanvasPaneContext) => void;
  onObjectDelete?: (object: CanvasObject, pane: CanvasPaneContext) => void;
  onSelectionChange?: (selection: CanvasSelectionChange) => void;
  onHistoryChange?: (state: CanvasHistoryState) => void;
  cardTemplates?: CardTemplateProvider;
  pluginCards?: CanvasPluginCardProvider;
};

export type CanvasCreationPreview =
  | {
      type: "box";
      tool:
        | "card"
        | "markdown-card"
        | "text"
        | "markdown"
        | "rect"
        | "ellipse"
        | "diamond"
        | "pentagon"
        | "parallelogram"
        | "add";
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
  hoveredInteractionObjectId: string | null = null;
  hoveredInteractionRegionId: string | null = null;
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
