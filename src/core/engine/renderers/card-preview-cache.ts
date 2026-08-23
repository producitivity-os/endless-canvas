import { Container, Rectangle, type Texture } from "pixi.js";
import type { ArrowObject, CanvasCardObject, CanvasObject } from "../../model";
import type { CanvasRenderContext } from "./renderer";

export interface CardPreviewRenderSource {
  generateTexture(target: Container, frame: Rectangle): Texture;
  renderElement(target: Container, element: CanvasObject, context: CanvasRenderContext): void;
  renderArrow(
    target: Container,
    arrow: ArrowObject,
    objects: readonly CanvasObject[],
    context: CanvasRenderContext,
  ): void;
}

export interface CardPreviewProvider {
  textureFor(card: CanvasCardObject): Texture | null;
  revision(cardId: string): number;
}

export class CardPreviewCache implements CardPreviewProvider {
  private readonly source: CardPreviewRenderSource;
  private readonly textures = new Map<string, Texture>();
  private readonly revisions = new Map<string, number>();
  private generations = 0;

  constructor(source: CardPreviewRenderSource) {
    this.source = source;
  }

  textureFor(card: CanvasCardObject): Texture | null {
    const existing = this.textures.get(card.id);
    if (existing) return existing;
    if (card.width <= 0 || card.height <= 0) return null;
    for (const element of card.elements) {
      if (element.type === "card") this.textureFor(element as CanvasCardObject);
    }
    const texture = this.generate(card);
    this.textures.set(card.id, texture);
    this.generations += 1;
    return texture;
  }

  invalidate(cardOrId: CanvasCardObject | string): void {
    const id = typeof cardOrId === "string" ? cardOrId : cardOrId.id;
    this.dispose(id);
    this.revisions.set(id, this.revision(id) + 1);
  }

  prune(objects: readonly CanvasObject[]): void {
    const retained = this.collectCardIds(objects);
    for (const id of this.textures.keys()) {
      if (!retained.has(id)) this.dispose(id);
    }
    for (const id of this.revisions.keys()) {
      if (!retained.has(id)) this.revisions.delete(id);
    }
  }

  revision(cardId: string): number {
    return this.revisions.get(cardId) ?? 0;
  }

  generationCount(): number {
    return this.generations;
  }

  destroy(): void {
    for (const id of [...this.textures.keys()]) this.dispose(id);
    this.revisions.clear();
  }

  private generate(card: CanvasCardObject): Texture {
    const target = new Container();
    const context: CanvasRenderContext = {
      scale: 1,
      hovered: false,
      selected: false,
    };
    const underArrows = card.elements.filter(
      (element): element is ArrowObject =>
        element.type === "arrow" && (element as ArrowObject).renderMode === "under",
    );
    const objects = card.elements.filter((element) => element.type !== "arrow");
    const overArrows = card.elements.filter(
      (element): element is ArrowObject =>
        element.type === "arrow" && (element as ArrowObject).renderMode !== "under",
    );
    for (const arrow of underArrows) {
      this.source.renderArrow(target, arrow, card.elements, context);
    }
    for (const object of objects) this.source.renderElement(target, object, context);
    for (const arrow of overArrows) {
      this.source.renderArrow(target, arrow, card.elements, context);
    }
    const texture = this.source.generateTexture(
      target,
      new Rectangle(0, 0, Math.max(1, card.width), Math.max(1, card.height)),
    );
    target.destroy({ children: true });
    return texture;
  }

  private collectCardIds(
    objects: readonly CanvasObject[],
    result = new Set<string>(),
  ): Set<string> {
    for (const object of objects) {
      if (object.type !== "card") continue;
      const card = object as CanvasCardObject;
      result.add(card.id);
      this.collectCardIds(card.elements, result);
    }
    return result;
  }

  private dispose(id: string): void {
    const texture = this.textures.get(id);
    if (!texture) return;
    texture.destroy(true);
    this.textures.delete(id);
  }
}
