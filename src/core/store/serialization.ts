import { normalizeImageUrl } from "@/api/canvas";
import { CanvasLink, createCard, createTextElement, type CanvasCard, type CanvasCardInit, type CanvasLink as CanvasLinkType, type CanvasViewport, type LinkRouting, type TextElementInit } from "@/features/canvas/model";

export function isValidViewport(value: CanvasViewport | undefined): value is CanvasViewport {
  return Boolean(value) && Number.isFinite(value?.x) && Number.isFinite(value?.y) && Number.isFinite(value?.scale) && value!.scale > 0;
}

export function cloneCards(cards: Array<CanvasCard | CanvasCardInit>) {
  const next = (structuredClone(cards) as unknown as CanvasCardInit[]).map(createCard);
  for (const card of next) card.elements = card.elements.map((element) => element.type === "text" ? createTextElement(element as unknown as TextElementInit) : element);
  return next;
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

export function normalizeLoadedLinks(value: CanvasLinkType[], cards: CanvasCard[]): CanvasLink[] {
  const cardIds = new Set(cards.map((card) => card.id));
  return value.filter((link) => link && cardIds.has(link.fromId) && cardIds.has(link.toId) && link.fromId !== link.toId).map((link) => new CanvasLink({ id: link.id || crypto.randomUUID(), fromId: link.fromId, toId: link.toId, routing: (link.routing === "straight" || link.routing === "orthogonal" ? link.routing : "bezier") as LinkRouting, startHead: ["triangle", "triangle-outline", "chicken"].includes(link.startHead) ? link.startHead : "none", endHead: ["triangle", "triangle-outline", "chicken"].includes(link.endHead) ? link.endHead : "none", fromAnchor: link.fromAnchor ?? { x: 0.5, y: 0.5 }, toAnchor: link.toAnchor ?? { x: 0.5, y: 0.5 }, bend: Number.isFinite(link.bend) ? link.bend : 0, strokeWidth: Number.isFinite(link.strokeWidth) ? link.strokeWidth : 2.8, label: link.label }));
}
