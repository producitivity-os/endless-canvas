import type { CanvasVisualBounds } from "../engine";
import type { CanvasViewport } from "../types";

export interface CanvasViewportFitOptions {
  padding?: number;
  minScale?: number;
  maxScale?: number;
}

export class CanvasViewportFitter {
  fit(
    bounds: CanvasVisualBounds,
    rendererSize: { width: number; height: number },
    options: CanvasViewportFitOptions = {},
  ): CanvasViewport {
    const padding = Math.max(0, options.padding ?? 48);
    const minScale = options.minScale ?? 0.1;
    const maxScale = options.maxScale ?? 5;
    const availableWidth = Math.max(1, rendererSize.width - padding * 2);
    const availableHeight = Math.max(1, rendererSize.height - padding * 2);
    const contentWidth = Math.max(bounds.width, 1);
    const contentHeight = Math.max(bounds.height, 1);
    const scale = Math.max(
      minScale,
      Math.min(maxScale, availableWidth / contentWidth, availableHeight / contentHeight),
    );
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    return {
      x: rendererSize.width / 2 - centerX * scale,
      y: rendererSize.height / 2 - centerY * scale,
      scale,
    };
  }
}

export const canvasViewportFitter = new CanvasViewportFitter();
