import { ArrowObject } from "../model";
import type { CanvasCardInit, CanvasCardObject } from "../model/card";
import type { CanvasViewport } from "../types/canvas";

export function isValidViewport(value: CanvasViewport | undefined): value is CanvasViewport {
  return (
    Boolean(value) &&
    Number.isFinite(value?.x) &&
    Number.isFinite(value?.y) &&
    Number.isFinite(value?.scale) &&
    value!.scale > 0
  );
}

export function cloneCards(cards: CanvasCardObject[]): CanvasCardObject[] {
  return structuredClone(cards);
}

export function cloneElementArrows(arrows: ArrowObject[]): ArrowObject[] {
  return arrows.map(
    (arrow) =>
      new ArrowObject({
        id: arrow.id,
        type: "arrow",
        x: arrow.x,
        y: arrow.y,
        width: arrow.width,
        height: arrow.height,
        rotation: arrow.rotation,
        opacity: arrow.opacity,
        start: {
          point: { ...arrow.start.point },
          binding: arrow.start.binding
            ? { ...arrow.start.binding, anchor: { ...arrow.start.binding.anchor } }
            : undefined,
        },
        end: {
          point: { ...arrow.end.point },
          binding: arrow.end.binding
            ? { ...arrow.end.binding, anchor: { ...arrow.end.binding.anchor } }
            : undefined,
        },
        path:
          arrow.path.type === "straight"
            ? { type: "straight" }
            : arrow.path.type === "curved"
              ? {
                  type: "curved",
                  controls: [{ ...arrow.path.controls[0] }, { ...arrow.path.controls[1] }],
                }
              : {
                  type: "angular",
                  orthogonal: arrow.path.orthogonal,
                  waypoints: arrow.path.waypoints.map((waypoint) => ({ ...waypoint })),
                },
        renderMode: arrow.renderMode,
        startHead: arrow.startHead,
        endHead: arrow.endHead,
        stroke: arrow.stroke,
        strokeWidth: arrow.strokeWidth,
      }),
  );
}

export function cardsAsPlainData(cards: CanvasCardObject[]) {
  return JSON.parse(JSON.stringify(cards)) as CanvasCardInit[];
}

export function cardsForStorage(cards: CanvasCardObject[]) {
  const next = cloneCards(cards);
  for (const card of next)
    for (const element of card.elements)
      if (element.type === "image") {
        //FIX: Fix
        // delete element.previewSrc;
        // element.src = normalizeImageUrl(element.src);
        // if (element.uploadStatus === "uploading") element.uploadStatus = "failed";
      }
  return next;
}

export function normalizeLoadedCards(cards: CanvasCardObject[]) {
  const next = cloneCards(cards);
  for (const card of next)
    for (const element of card.elements)
      if (element.type === "image") {
        //FIX: Fix
        // element.src = normalizeImageUrl(element.src);
        // delete element.previewSrc;
        // element.lockAspectRatio ??= true;
        // if (element.src && element.uploadStatus !== "failed") element.uploadStatus = "ready";
      }
  return next;
}

export function normalizeImageUrl(src: string): string {
  if (!src) {
    return "";
  }

  const value = src.trim();

  if (
    value.startsWith("data:") ||
    value.startsWith("blob:") ||
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("file://") ||
    value.startsWith("asset://")
  ) {
    return value;
  }

  return value;
}
