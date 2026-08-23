import type { CanvasObject } from "../model";
import type { CanvasCardObject } from "../model/card";

export class CanvasClipboard {
  private card: CanvasCardObject | null = null;

  private elements: CanvasObject[] = [];

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

  copyCard(card: CanvasCardObject): void {
    this.card = this.cloneCard(card);
  }

  copyElements(elements: Iterable<CanvasObject>): void {
    this.elements = Array.from(elements, (element) => this.cloneElement(element));
  }

  pasteCard(): CanvasCardObject | null {
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
  ): CanvasObject[] {
    if (!this.hasElements) {
      return [];
    }

    const pasted = this.elements.map((element) => {
      const clone = this.cloneElement(element);

      clone.id = crypto.randomUUID();
      clone.translate(offset.x, offset.y);

      return clone;
    });

    this.elements = pasted.map((element) => this.cloneElement(element));

    return pasted;
  }

  private cloneCard(card: CanvasCardObject): CanvasCardObject {
    return structuredClone(card);
  }

  private cloneElement(element: CanvasObject): CanvasObject {
    const clone = structuredClone(element);

    //FIX: uncomment this
    // if (clone.type === "text") {
    //   return createTextElement(clone as TextElementInit);
    // }

    return clone;
  }
}
