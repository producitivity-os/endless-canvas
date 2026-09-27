import type { ArrowObject } from "../model/arrow/arrow.ts";
import type { CanvasObject } from "../model/object.ts";
import { visibleCanvasObjects } from "../model/layers.ts";
import type { CanvasViewport, EndlessCanvasState } from "../types/canvas.ts";
import type { CanvasPoint } from "../types/geometry.ts";
import { arrowPathGeometry } from "./arrows/arrow-path-geometry.ts";
import { boxGeometry } from "./box-geometry.ts";
import { canvasVisualBounds, type CanvasVisualBounds } from "./visual-bounds.ts";

export interface CanvasOverviewCard {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
  readonly points: readonly CanvasPoint[];
}

export interface CanvasOverviewConnector {
  readonly id: string;
  readonly points: readonly CanvasPoint[];
}

export interface CanvasOverviewSnapshot {
  readonly cards: readonly CanvasOverviewCard[];
  readonly connectors: readonly CanvasOverviewConnector[];
  readonly contentBounds: Readonly<CanvasVisualBounds> | null;
  readonly viewportBounds: Readonly<CanvasVisualBounds>;
  readonly rendererSize: Readonly<{ width: number; height: number }>;
}

export class CanvasOverviewProjector {
  snapshot(
    state: EndlessCanvasState,
    viewport: CanvasViewport,
    rendererSize: { width: number; height: number },
  ): CanvasOverviewSnapshot {
    const visible = visibleCanvasObjects(state);
    const scale = Math.max(viewport.scale, 0.001);
    const cards = visible
      .filter((object) => object.type === "card")
      .map((object) => this.card(object));
    const connectors = visible
      .filter((object): object is ArrowObject => object.type === "arrow")
      .map((arrow) => this.connector(arrow, state.objects))
      .filter((connector): connector is CanvasOverviewConnector => connector !== null);
    const contentBounds = canvasVisualBounds.forObjects(visible);

    return Object.freeze({
      cards: Object.freeze(cards),
      connectors: Object.freeze(connectors),
      contentBounds: contentBounds ? Object.freeze({ ...contentBounds }) : null,
      viewportBounds: Object.freeze({
        x: -viewport.x / scale,
        y: -viewport.y / scale,
        width: rendererSize.width / scale,
        height: rendererSize.height / scale,
      }),
      rendererSize: Object.freeze({ ...rendererSize }),
    });
  }

  private card(object: CanvasObject): CanvasOverviewCard {
    const center = boxGeometry.center(object);
    const points = [
      { x: object.x, y: object.y },
      { x: object.x + object.width, y: object.y },
      { x: object.x + object.width, y: object.y + object.height },
      { x: object.x, y: object.y + object.height },
    ].map((point) => Object.freeze(boxGeometry.rotatePoint(point, center, object.rotation)));
    return Object.freeze({
      id: object.id,
      x: object.x,
      y: object.y,
      width: object.width,
      height: object.height,
      rotation: object.rotation,
      points: Object.freeze(points),
    });
  }

  private connector(
    arrow: ArrowObject,
    objects: readonly CanvasObject[],
  ): CanvasOverviewConnector | null {
    const points = arrowPathGeometry.resolve(arrow, objects).visible;
    if (points.length < 2) return null;
    return Object.freeze({
      id: arrow.id,
      points: Object.freeze(points.map((point) => Object.freeze({ ...point }))),
    });
  }
}

export const canvasOverviewProjector = new CanvasOverviewProjector();
