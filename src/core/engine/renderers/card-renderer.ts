import { Container, Graphics, Sprite } from "pixi.js";
import type { CanvasCardObject } from "../../model";
import { theme } from "../theme";
import type { CanvasRenderContext, ElementRenderer } from "./renderer";
import type { CardPreviewProvider } from "./card-preview-cache";

export class CardRenderer implements ElementRenderer<CanvasCardObject> {
  private readonly previews?: CardPreviewProvider;

  constructor(previews?: CardPreviewProvider) {
    this.previews = previews;
  }

  render(target: Container, card: CanvasCardObject, context: CanvasRenderContext): void {
    const root = new Container();

    root.position.set(card.x + card.width / 2, card.y + card.height / 2);
    root.pivot.set(card.width / 2, card.height / 2);
    root.rotation = card.rotation;
    root.alpha = card.opacity;

    this.drawBackground(root, card);
    const texture = this.previews?.textureFor(card);
    if (texture) {
      const preview = new Sprite(texture);
      preview.eventMode = "none";
      root.addChild(preview);
    }
    if (context.hovered && !context.selected) {
      this.drawHover(root, card, context.scale);
    }
    target.addChild(root);
  }

  invalidationKey(card: CanvasCardObject, context: CanvasRenderContext): string {
    return JSON.stringify([
      card.x,
      card.y,
      card.width,
      card.height,
      card.rotation,
      card.opacity,
      card.backgroundColor,
      context.hovered,
      context.selected,
      context.scale,
      this.previews?.revision(card.id) ?? 0,
    ]);
  }

  private drawBackground(target: Container, card: CanvasCardObject): void {
    const { radius } = theme.elements.card;
    const background = new Graphics()
      .roundRect(0, 0, card.width, card.height, radius)
      .fill({
        color: card.backgroundColor ?? 0xffffff,
      })
      .stroke({
        color: 0xd4d4d8,
        width: 1,
      });

    target.addChild(background);
  }

  private drawHover(target: Container, card: CanvasCardObject, scale: number): void {
    const chromeScale = 1 / Math.max(scale, 0.001);
    const { outline, radius } = theme.elements.card;
    const padding = (outline.padding / 2) * chromeScale;
    target.addChild(
      new Graphics()
        .roundRect(
          -padding,
          -padding,
          card.width + padding * 2,
          card.height + padding * 2,
          radius * chromeScale,
        )
        .stroke({ color: theme.interaction.hoverColor, width: outline.width * chromeScale }),
    );
  }
}
