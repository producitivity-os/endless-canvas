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
import { VideoObject, type VideoObjectInit } from "./video/video.ts";

export class CanvasObjectFactory {
  private readonly hydrators = new Map<string, (object: CanvasObject) => CanvasObject>();

  register(type: string, hydrate: (object: CanvasObject) => CanvasObject): void {
    this.hydrators.set(type, hydrate);
  }

  hydrate(object: CanvasObject): CanvasObject {
    if (typeof object.bounds === "function") {
      return object;
    }

    const type = (object as { type: CanvasObjectType }).type;
    const customHydrator = this.hydrators.get(type);
    if (customHydrator) return customHydrator(object);
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
      case "video":
        return new VideoObject(object as unknown as VideoObjectInit);
      default:
        throw new Error(`Unknown canvas object type: ${String(type)}`);
    }
  }
}

export const canvasObjectFactory = new CanvasObjectFactory();
