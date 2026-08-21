import { CanvasLink, ElementArrow, type CanvasLinkInit } from "../model/arrow";
import type { CanvasCard } from "../model/card";
import type { CanvasCardInit, CanvasViewport } from "../types/canvas";
import type { Point } from "../types/geometry";

export function isValidViewport(value: CanvasViewport | undefined): value is CanvasViewport {
  return Boolean(value) && Number.isFinite(value?.x) && Number.isFinite(value?.y) && Number.isFinite(value?.scale) && value!.scale > 0;
}

export function cloneCards(
  cards: CanvasCard[],
): CanvasCard[] {
  return structuredClone(cards);
}

export function cloneElementArrows(
  arrows: ElementArrow[],
): ElementArrow[] {
  return arrows.map(
    (arrow) =>
      new ElementArrow({
        id: arrow.id,

        fromElementId:
          arrow.fromElementId,

        toElementId:
          arrow.toElementId,

        fromAnchor: {
          ...arrow.fromAnchor,
        },

        toAnchor: {
          ...arrow.toAnchor,
        },

        routing:
          arrow.routing,

        startHead:
          arrow.startHead,

        endHead:
          arrow.endHead,

        bend:
          arrow.bend,

        strokeWidth:
          arrow.strokeWidth,
      }),
  );
}
export function cloneLinks(
  links: CanvasLink[],
): CanvasLink[] {
  return links.map(
    (link) =>
      new CanvasLink({
        id: link.id,

        fromId:
          link.fromId,

        toId:
          link.toId,

        fromAnchor: {
          ...link.fromAnchor,
        },

        toAnchor: {
          ...link.toAnchor,
        },

        routing:
          link.routing,

        startHead:
          link.startHead,

        endHead:
          link.endHead,

        bend:
          link.bend,

        strokeWidth:
          link.strokeWidth,

        label:
          link.label,
      }),
  );
}

export function cardsAsPlainData(cards: CanvasCard[]) { return JSON.parse(JSON.stringify(cards)) as CanvasCardInit[]; }

export function cardsForStorage(cards: CanvasCard[]) {
  const next = cloneCards(cards);
  for (const card of next) for (const element of card.elements) if (element.type === "image") { delete element.previewSrc; element.src = normalizeImageUrl(element.src); if (element.uploadStatus === "uploading") element.uploadStatus = "failed"; }
  return next;
}

export function normalizeLoadedCards(cards: CanvasCard[]) {
  const next = cloneCards(cards);
  for (const card of next) for (const element of card.elements) if (element.type === "image") { element.src = normalizeImageUrl(element.src); delete element.previewSrc; element.lockAspectRatio ??= true; if (element.src && element.uploadStatus !== "failed") element.uploadStatus = "ready"; }
  return next;
}

export function normalizeImageUrl(
  src: string,
): string {
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

export function normalizeLoadedLinks(
  value: CanvasLinkInit[],
  cards: CanvasCard[],
): CanvasLink[] {
  const cardIds =
    new Set(
      cards.map((card) => card.id),
    );

  return value
    .filter(
      (link) =>
        cardIds.has(link.fromId) &&
        cardIds.has(link.toId) &&
        link.fromId !== link.toId,
    )
    .map(
      (link) =>
        new CanvasLink({
          ...link,

          id:
            link.id ??
            crypto.randomUUID(),

          routing:
            link.routing === "straight" ||
              link.routing === "orthogonal"
              ? link.routing
              : "bezier",

          startHead:
            link.startHead === "triangle" ||
              link.startHead === "triangle-outline" ||
              link.startHead === "chicken"
              ? link.startHead
              : "none",

          endHead:
            link.endHead === "triangle" ||
              link.endHead === "triangle-outline" ||
              link.endHead === "chicken"
              ? link.endHead
              : "none",

          fromAnchor:
            link.fromAnchor ??
            {
              x: 0.5,
              y: 0.5,
            } as Point,

          toAnchor:
            link.toAnchor ??
            {
              x: 0.5,
              y: 0.5,
            },

          bend:
            Number.isFinite(link.bend)
              ? link.bend
              : 0,

          strokeWidth:
            Number.isFinite(
              link.strokeWidth,
            )
              ? link.strokeWidth
              : 2.8,

          label:
            link.label ?? "",
        }),
    );
}
