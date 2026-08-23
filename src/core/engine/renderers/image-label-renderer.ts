import { Container, Graphics, Text as PixiText, TextStyle } from "pixi.js";
import type { ImageObject } from "../../model";
import { theme } from "../theme.ts";

export interface ImageLabelFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageLabelPlacements {
  size: { x: number; y: number };
  filename: { x: number; y: number };
}

export class ImageLabelRenderer {
  private readonly cornerInset = 13;
  private readonly style = new TextStyle({
    fill: 0xffffff,
    fontFamily: "Inter Variable, Inter, system-ui, sans-serif",
    fontSize: 11,
    fontWeight: "600",
  });

  render(
    target: Container,
    image: ImageObject,
    scale: number,
    frame: ImageLabelFrame = { x: 0, y: 0, width: image.width, height: image.height },
    handleFrame: ImageLabelFrame = frame,
  ): void {
    const chromeScale = 1 / Math.max(scale, 0.001);
    const root = new Container();
    root.position.set(image.x + image.width / 2, image.y + image.height / 2);
    root.pivot.set(image.width / 2, image.height / 2);
    root.rotation = image.rotation;
    this.drawSize(root, image, frame, handleFrame, chromeScale);
    this.drawFilename(root, image, frame, handleFrame, chromeScale, scale);
    target.addChild(root);
  }

  placements(
    frame: ImageLabelFrame,
    handleFrame: ImageLabelFrame,
    scale: number,
  ): ImageLabelPlacements {
    const chromeScale = 1 / Math.max(scale, 0.001);
    return {
      size: {
        x: handleFrame.x + this.cornerInset * chromeScale,
        y: frame.y + frame.height,
      },
      filename: {
        x: handleFrame.x + handleFrame.width - this.cornerInset * chromeScale,
        y: frame.y,
      },
    };
  }

  private drawSize(
    target: Container,
    image: ImageObject,
    frame: ImageLabelFrame,
    handleFrame: ImageLabelFrame,
    chromeScale: number,
  ): void {
    const label = new Container();
    const text = new PixiText({
      text: `${Math.round(image.width)} × ${Math.round(image.height)} px`,
      style: this.style,
    });
    const width = Math.ceil(text.width + 14);
    const height = 22;
    const radius = 5;
    const background = new Graphics()
      .moveTo(0, 0)
      .lineTo(width, 0)
      .lineTo(width, height - radius)
      .quadraticCurveTo(width, height, width - radius, height)
      .lineTo(radius, height)
      .quadraticCurveTo(0, height, 0, height - radius)
      .closePath()
      .fill({ color: theme.interaction.hoverColor, alpha: 0.98 });
    text.position.set(7, 4);
    label.addChild(background, text);
    label.scale.set(chromeScale);
    const placement = this.placements(frame, handleFrame, 1 / chromeScale).size;
    label.position.set(placement.x, placement.y);
    target.addChild(label);
  }

  private drawFilename(
    target: Container,
    image: ImageObject,
    frame: ImageLabelFrame,
    handleFrame: ImageLabelFrame,
    chromeScale: number,
    scale: number,
  ): void {
    const maximumWidth = Math.max(32, Math.min(220, frame.width * scale));
    const text = new PixiText({ text: image.name?.trim() || "Untitled image", style: this.style });
    this.truncate(text, maximumWidth - 14);
    const width = Math.min(maximumWidth, Math.ceil(text.width + 14));
    const height = 22;
    const radius = 5;
    const label = new Container();
    label.addChild(
      new Graphics()
        .moveTo(-width, 0)
        .lineTo(-width, -height + radius)
        .quadraticCurveTo(-width, -height, -width + radius, -height)
        .lineTo(-radius, -height)
        .quadraticCurveTo(0, -height, 0, -height + radius)
        .lineTo(0, 0)
        .closePath()
        .fill({ color: theme.interaction.hoverColor, alpha: 0.98 }),
      text,
    );
    text.position.set(-width + 7, -height + 4);
    label.scale.set(chromeScale);
    const placement = this.placements(frame, handleFrame, 1 / chromeScale).filename;
    label.position.set(placement.x, placement.y);
    target.addChild(label);
  }

  private truncate(text: PixiText, maximumWidth: number): void {
    const original = text.text;
    if (text.width <= maximumWidth) return;
    let low = 0;
    let high = original.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      text.text = `${original.slice(0, middle)}…`;
      if (text.width <= maximumWidth) low = middle;
      else high = middle - 1;
    }
    text.text = low > 0 ? `${original.slice(0, low)}…` : "…";
  }
}
