import type { CanvasCard } from "../model/card";
import { createTextElement, type TextElementInit } from "../model/text";
import type { CanvasElement } from "../types/elements";

export class CanvasClipboard {
  private card: CanvasCard | null = null;

  private elements: CanvasElement[] = [];

  get hasCard(): boolean {
    return this.card !== null;
  }

  get hasElements(): boolean {
    return this.elements.length > 0;
  }

  clear(): void {
    this.card = null;
    this.elements = [];
  }

  clearCard(): void {
    this.card = null;
  }

  clearElements(): void {
    this.elements = [];
  }

  copyCard(card: CanvasCard): void {
    this.card = this.cloneCard(card);
  }

  copyElements(elements: Iterable<CanvasElement>): void {
    this.elements = Array.from(elements, (element) => this.cloneElement(element));
  }

  pasteCard(): CanvasCard | null {
    if (!this.card) {
      return null;
    }

    const card = this.cloneCard(this.card);

    card.id = crypto.randomUUID();

    return card;
  }

  pasteElements(
    offset = {
      x: 24,
      y: 24,
    },
  ): CanvasElement[] {
    if (!this.hasElements) {
      return [];
    }

    const pasted = this.elements.map((element) => {
      const clone = this.cloneElement(element);

      clone.id = crypto.randomUUID();

      //FIX: Uncomment this
      // translateElement(
      //   clone,
      //   offset.x,
      //   offset.y,
      // );

      return clone;
    });

    this.elements = pasted.map((element) => this.cloneElement(element));

    return pasted;
  }

  private cloneCard(card: CanvasCard): CanvasCard {
    return structuredClone(card);
  }

  private cloneElement(element: CanvasElement): CanvasElement {
    const clone = structuredClone(element);

    if (clone.type === "text") {
      return createTextElement(clone as TextElementInit);
    }

    return clone;
  }
}
