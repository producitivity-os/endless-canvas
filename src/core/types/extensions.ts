import type { ElementRenderer } from "../engine/renderers/renderer.ts";
import type { ArrowObject, CanvasObject } from "../model/index.ts";
import type { CanvasViewport } from "./canvas.ts";
import type { CanvasPoint } from "./geometry.ts";
import type { ArrowHint } from "../model/arrow/arrow.ts";

export type CanvasSelectionGeometry =
  | { shape: "none"; radius?: never; strokeWidth?: never; strokeColor?: never }
  | { shape: "rectangle"; radius?: number; strokeWidth?: number; strokeColor?: number }
  | { shape: "ellipse"; strokeWidth?: number; strokeColor?: number }
  | { shape: "diamond"; strokeWidth?: number; strokeColor?: number };

export interface CanvasConnectionHandleMetadata {
  hint: ArrowHint;
  anchor: CanvasPoint;
  direction?: "input" | "output" | "both";
  shape?: "circle" | "rounded-rectangle";
}

export interface CanvasObjectMinimumSize {
  width?: number;
  height?: number;
}

/** A pointer target expressed in the object's unrotated local coordinate space. */
export interface CanvasObjectPointerInteractionRegion {
  id: string;
  bounds: { x: number; y: number; width: number; height: number };
  cursor?: string;
  /** Passive regions report clicks while preserving the object's normal drag gesture. */
  capture?: boolean;
}

export interface CanvasObjectPointerGesture {
  phase: "start" | "move" | "end" | "cancel";
  localPoint: CanvasPoint;
}

export interface CanvasObjectExtension<T extends CanvasObject = CanvasObject> {
  type: string;
  hydrate(object: CanvasObject): T;
  createRenderer?: () => ElementRenderer<T>;
  selectionGeometry?: (object: T) => CanvasSelectionGeometry | null;
  permanentConnectionHandles?: boolean | ((object: T) => boolean);
  connectionHandles?: (object: T) => readonly CanvasConnectionHandleMetadata[];
  minimumSize?: (object: T) => CanvasObjectMinimumSize | null;
  pointerInteractionRegions?: (object: T) => readonly CanvasObjectPointerInteractionRegion[];
  onPointerInteraction?: (object: T, regionId: string, objects: readonly CanvasObject[]) => boolean;
  onPointerGesture?: (object: T, regionId: string, gesture: CanvasObjectPointerGesture, objects: readonly CanvasObject[]) => boolean;
}

export interface CanvasHistoryState {
  canUndo: boolean;
  canRedo: boolean;
}

export interface CanvasSelectionChange {
  selectedIds: readonly string[];
  selectedObjects: readonly CanvasObject[];
  primaryObject: CanvasObject | null;
  viewport: CanvasViewport;
}

export interface CanvasConnectionDropRequest {
  arrow: ArrowObject;
  sourceObject: CanvasObject;
  worldPoint: CanvasPoint;
  screenPoint: CanvasPoint;
}

export type CanvasConnectionDropHandler = (
  request: CanvasConnectionDropRequest,
) => Promise<CanvasObject | null> | CanvasObject | null;
