import type { CanvasPoint, ResizeHandle } from "../types";
import type { ShapeParameterDragEvent } from "./shape-parameter-drag";

export type CanvasDragEventType =
  "object" | "pan" | "draw-object" | "resize-object" | "rotate-object" | "adjust-shape-parameter";

export interface OriginalObjectBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CanvasDragEvent =
  | {
      type: "object";
      objectId: string;
      pointerStart: CanvasPoint;
      objectStart: CanvasPoint;
    }
  | {
      type: "pan";
      pointerStart: CanvasPoint;
      viewportStart: CanvasPoint;
    }
  | {
      type: "draw-object";
      origin: CanvasPoint;
      current: CanvasPoint;
    }
  | {
      type: "resize-object";
      objectId: string;
      originalBounds: OriginalObjectBounds;
      originalRotation: number;
      handle: ResizeHandle;
      pointerOrigin: CanvasPoint;
    }
  | {
      type: "rotate-object";
      objectId: string;
      originalBounds: OriginalObjectBounds;
      originalRotation: number;
      pointerOrigin: CanvasPoint;
      previousPointerAngle: number;
      accumulatedRotation: number;
    }
  | ShapeParameterDragEvent;
