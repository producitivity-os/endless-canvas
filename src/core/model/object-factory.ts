import { ArrowObject, type ArrowObjectInit } from "./arrow/arrow.ts";
import { createCard, type CanvasCardInit } from "./card/card.ts";
import { ImageObject, type ImageObjectInit } from "./image/image.ts";
import type { CanvasObject, CanvasObjectType } from "./object.ts";
import {
  DiamondObject,
  EllipseObject,
  ParallelogramObject,
  PathObject,
  PentagonObject,
  RectangleObject,
  type DiamondObjectInit,
  type EllipseObjectInit,
  type ParallelogramObjectInit,
  type PathObjectInit,
  type PentagonObjectInit,
  type RectangleObjectInit,
} from "./shapes/index.ts";
import { TextObject, type TextObjectInit } from "./text/text.ts";

export class CanvasObjectFactory {
  hydrate(object: CanvasObject): CanvasObject {
    if (typeof object.bounds === "function") {
      return object;
    }

    const type = (object as { type: CanvasObjectType }).type;
    switch (type) {
      case "card": {
        const card = object as unknown as CanvasCardInit;
        return createCard({
          ...card,
          elements: card.elements.map((element) => this.hydrate(element)),
        });
      }
      case "rect":
        return new RectangleObject(object as unknown as RectangleObjectInit);
      case "ellipse":
        return new EllipseObject(object as unknown as EllipseObjectInit);
      case "diamond":
        return new DiamondObject(object as unknown as DiamondObjectInit);
      case "pentagon":
        return new PentagonObject(object as unknown as PentagonObjectInit);
      case "parallelogram":
        return new ParallelogramObject(object as unknown as ParallelogramObjectInit);
      case "image":
        return new ImageObject(object as unknown as ImageObjectInit);
      case "path":
        return new PathObject(object as unknown as PathObjectInit);
      case "arrow":
        return new ArrowObject(object as unknown as ArrowObjectInit);
      case "text":
        return new TextObject(object as unknown as TextObjectInit);
      default:
        throw new Error(`Unknown canvas object type: ${String(type)}`);
    }
  }
}

export const canvasObjectFactory = new CanvasObjectFactory();
