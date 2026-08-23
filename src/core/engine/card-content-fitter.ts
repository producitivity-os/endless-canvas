import type { ArrowObject } from "../model/arrow/arrow.ts";
import type { CanvasCardObject } from "../model/card/card.ts";
import { arrowBindingResolver } from "./arrows/arrow-binding-resolver.ts";
import {
  fittedCardPadding,
  illustrationCardPadding,
  minCardHeight,
  minCardWidth,
} from "./utils.ts";
import { canvasVisualBounds } from "./visual-bounds.ts";

export class CardContentFitter {
  private readonly epsilon = 0.000001;

  fit(card: CanvasCardObject): boolean {
    const bounds = canvasVisualBounds.forObjects(card.elements);
    if (!bounds) {
      const changed = card.width !== minCardWidth || card.height !== minCardHeight;
      card.width = minCardWidth;
      card.height = minCardHeight;
      return changed;
    }

    const padding = card.kind === "text" ? fittedCardPadding : illustrationCardPadding;
    const rawOffset = { x: bounds.x - padding, y: bounds.y - padding };
    const offset = {
      x: Math.abs(rawOffset.x) < this.epsilon ? 0 : rawOffset.x,
      y: Math.abs(rawOffset.y) < this.epsilon ? 0 : rawOffset.y,
    };
    const width = Math.max(minCardWidth, bounds.width + padding * 2);
    const height = Math.max(minCardHeight, bounds.height + padding * 2);
    const changed =
      offset.x !== 0 ||
      offset.y !== 0 ||
      Math.abs(card.width - width) >= this.epsilon ||
      Math.abs(card.height - height) >= this.epsilon;
    if (!changed) return false;

    this.repositionCard(card, offset, width, height);
    for (const element of card.elements) {
      element.translate(-offset.x, -offset.y);
    }
    for (const element of card.elements) {
      if (element.type !== "arrow") continue;
      const arrow = element as ArrowObject;
      const start = arrowBindingResolver.resolveAndRemember(arrow.start, card.elements);
      const end = arrowBindingResolver.resolveAndRemember(arrow.end, card.elements);
      arrow.updateBounds(start, end);
    }
    return true;
  }

  private repositionCard(
    card: CanvasCardObject,
    offset: { x: number; y: number },
    width: number,
    height: number,
  ): void {
    const oldHalf = { x: card.width / 2, y: card.height / 2 };
    const oldCenter = { x: card.x + oldHalf.x, y: card.y + oldHalf.y };
    const nextHalf = { x: width / 2, y: height / 2 };
    const localCenterShift = {
      x: offset.x + nextHalf.x - oldHalf.x,
      y: offset.y + nextHalf.y - oldHalf.y,
    };
    const cosine = Math.cos(card.rotation);
    const sine = Math.sin(card.rotation);
    const rotatedShift = {
      x: localCenterShift.x * cosine - localCenterShift.y * sine,
      y: localCenterShift.x * sine + localCenterShift.y * cosine,
    };
    card.width = width;
    card.height = height;
    card.x = oldCenter.x + rotatedShift.x - nextHalf.x;
    card.y = oldCenter.y + rotatedShift.y - nextHalf.y;
  }
}

export const cardContentFitter = new CardContentFitter();

export function fitCardToContent(card: CanvasCardObject): boolean {
  return cardContentFitter.fit(card);
}
