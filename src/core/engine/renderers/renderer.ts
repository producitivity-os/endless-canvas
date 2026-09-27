import type { Container } from "pixi.js";
import type { CanvasObject } from "../../model";
import type { CanvasImageCropPreview } from "../../types";

export interface CanvasRenderContext {
  scale: number;
  editing?: boolean;
  hovered: boolean;
  hoveredRegionId?: string;
  selected: boolean;
  interactionColor: number;
  imageCrop?: CanvasImageCropPreview;
}

export interface ElementRenderer<T extends CanvasObject> {
  render(target: Container, element: T, context: CanvasRenderContext): void;
  reconcile?(target: Container, element: T, context: CanvasRenderContext): void;
  invalidationKey?(element: T, context: CanvasRenderContext): string;
  dispose?(target: Container, objectId: string): void;
}
