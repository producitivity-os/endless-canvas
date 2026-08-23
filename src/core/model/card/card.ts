import type { CardIndexItem } from "../../types";
import { CanvasObject, type CanvasObjectInit, type CanvasObjectType } from "../object.ts";
import type { ArrowObject } from "../arrow";

export interface CanvasCardInit extends CanvasObjectInit {
  id: string;
  kind?: "text";
  textSizing?: "fit" | "custom";
  x: number;
  y: number;
  width: number;
  height: number;
  elements: CanvasObject[];
  arrows?: ArrowObject[];
  backgroundColor?: number;
  locked?: boolean;
}

export abstract class CanvasCardObject extends CanvasObject {
  abstract kind?: "text";
  id: string;
  textSizing?: "fit" | "custom";
  x: number;
  y: number;
  width: number;
  height: number;
  elements: CanvasObject[];
  arrows?: ArrowObject[];
  backgroundColor?: number;
  locked: boolean;

  constructor(init: CanvasCardInit) {
    super(init);
    this.id = init.id;
    this.textSizing = init.textSizing;
    this.x = init.x;
    this.y = init.y;
    this.width = init.width;
    this.height = init.height;
    this.elements = init.elements;
    // this.elements = init.elements.map((element) =>
    //   element.type === "text" ? new TextObject(element as TextObjectInit) : hydrateElement(element),
    // );
    // this.arrows = init.arrows?.map(
    //   (arrow) =>
    //     new CanvasCardObject({
    //       ...arrow,
    //       routing: arrow.routing ?? "straight",
    //       endHead: arrow.endHead ?? "triangle",
    //     }),
    // );
    this.backgroundColor = init.backgroundColor;
    this.locked = init.locked ?? false;
    this.type = "card";
  }
  type: CanvasObjectType;

  indexItem(): CardIndexItem {
    return {
      minX: this.x,
      minY: this.y,
      maxX: this.x + this.width,
      maxY: this.y + this.height,
      id: this.id,
    };
  }

  contentBounds() {
    // const bounds = this.elements
    //   .map(fitElementBounds)
    //   .filter((value): value is Rectangle => Boolean(value));
    // if (bounds.length === 0) return null;
    // const minX = Math.min(...bounds.map(({ x }) => x));
    // const minY = Math.min(...bounds.map(({ y }) => y));
    // const maxX = Math.max(...bounds.map(({ x, width }) => x + width));
    // const maxY = Math.max(...bounds.map(({ y, height }) => y + height));
    // return new Rectangle(minX, minY, maxX - minX, maxY - minY);
  }

  fitToContent() {
    // const bounds = this.contentBounds();
    // if (!bounds) {
    //   this.width = minCardWidth;
    //   this.height = minCardHeight;
    //   return;
    // }
    //
    // const padding = this.kind === "text" ? fittedCardPadding : illustrationCardPadding;
    // const offset = { x: bounds.x - padding, y: bounds.y - padding };
    // this.x += offset.x;
    // this.y += offset.y;
    // this.width = bounds.width + padding * 2;
    // this.height = bounds.height + padding * 2;
    // for (const element of this.elements) {
    //   if (element.type === "path") {
    //     for (const point of element.points) {
    //       point.x -= offset.x;
    //       point.y -= offset.y;
    //     }
    //   } else {
    //     element.x -= offset.x;
    //     element.y -= offset.y;
    //   }
    // }
  }
}

export class IllustrationCard extends CanvasCardObject {
  kind = undefined;
}
export class TextCard extends CanvasCardObject {
  kind = "text" as const;
}

export function createCard(init: CanvasCardInit) {
  return init.kind === "text" ? new TextCard(init) : new IllustrationCard(init);
}

export type BrowserMathJax = {
  startup?: { promise?: Promise<void>; typeset?: boolean };
  svg?: unknown;
  tex?: unknown;
  tex2svg?: (source: string, options?: { display?: boolean }) => Element;
};
