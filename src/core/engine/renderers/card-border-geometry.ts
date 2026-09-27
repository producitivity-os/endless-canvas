import { theme } from "../theme.ts";

export class CardBorderGeometry {
  radiusFor(width: number, height: number): number {
    return Math.min(theme.elements.card.radius, Math.max(0, width) / 2, Math.max(0, height) / 2);
  }
}

export const cardBorderGeometry = new CardBorderGeometry();
