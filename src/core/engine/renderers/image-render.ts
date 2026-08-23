import { Container, Graphics, Sprite } from "pixi.js";
import type { ImageObject } from "../../model";
import {
  drawBrokenImageIcon,
  imageIsLoading,
  imageLoadFailed,
  imageTextureFor,
} from "../../model/image";
import { detailSelectionColor } from "../utils";
import type { ElementRenderer } from "./renderer";
import type { CanvasRenderContext } from "./renderer";
import { theme } from "../theme";

export class ImageRenderer implements ElementRenderer<ImageObject> {
  render(target: Container, imageObject: ImageObject, context: CanvasRenderContext): void {
    const root = new Container();

    const source = imageObject.previewSrc || imageObject.src;
    const texture = imageTextureFor(source);
    const loading = imageObject.uploadStatus === "uploading" || imageIsLoading(source);
    const radius = Math.max(
      0,
      Math.min(imageObject.cornerRadius ?? 0, imageObject.width / 2, imageObject.height / 2),
    );

    if (texture) {
      if (context.imageCrop) {
        this.drawCropPreview(root, texture, context.imageCrop, imageObject);
      } else {
        this.drawImage(root, texture, imageObject, radius);
      }
    } else {
      const failed = imageLoadFailed(source);

      root.addChild(
        new Graphics()
          .roundRect(0, 0, imageObject.width, imageObject.height, radius)
          .fill({ color: failed ? 0xf1f2f4 : 0xe5e7eb })
          .stroke({ color: 0xd1d5db, width: 1 }),
      );

      if (failed) {
        root.addChild(drawBrokenImageIcon(imageObject.width, imageObject.height));
      }
    }

    if (loading) {
      const width = Math.max(44, Math.min(140, imageObject.width - 24));
      const x = (imageObject.width - width) / 2;
      const y = imageObject.height / 2 - 5;

      root.addChild(
        new Graphics()
          .roundRect(x, y, width, 10, 999)
          .fill({ color: detailSelectionColor, alpha: 0.16 })
          .roundRect(x, y, width * 0.58, 10, 999)
          .fill({ color: detailSelectionColor, alpha: 0.82 }),
      );
    }

    if (context.hovered && !context.selected && !context.imageCrop) {
      const chromeScale = 1 / Math.max(context.scale, 0.001);
      root.addChild(
        new Graphics().roundRect(0, 0, imageObject.width, imageObject.height, radius).stroke({
          color: theme.interaction.hoverColor,
          width: theme.interaction.frameWidth * chromeScale,
        }),
      );
    }

    root.position.set(
      imageObject.x + imageObject.width / 2,
      imageObject.y + imageObject.height / 2,
    );
    root.pivot.set(imageObject.width / 2, imageObject.height / 2);
    root.rotation = imageObject.rotation;
    root.alpha = imageObject.opacity ?? 1;
    target.addChild(root);
  }

  private drawImage(
    target: Container,
    texture: ConstructorParameters<typeof Sprite>[0],
    imageObject: ImageObject,
    radius: number,
  ): void {
    const sprite = new Sprite(texture);
    const crop = imageObject.crop ?? { x: 0, y: 0, width: 1, height: 1 };
    sprite.width = imageObject.width / Math.max(0.001, crop.width);
    sprite.height = imageObject.height / Math.max(0.001, crop.height);
    sprite.position.set(-crop.x * sprite.width, -crop.y * sprite.height);
    sprite.alpha = imageObject.uploadStatus === "uploading" ? 0.38 : 1;

    const mask = new Graphics()
      .roundRect(0, 0, imageObject.width, imageObject.height, radius)
      .fill({ color: 0xffffff });
    sprite.mask = mask;
    target.addChild(mask, sprite);
  }

  private drawCropPreview(
    target: Container,
    texture: ConstructorParameters<typeof Sprite>[0],
    crop: NonNullable<CanvasRenderContext["imageCrop"]>,
    imageObject: ImageObject,
  ): void {
    const dimmed = new Sprite(texture);
    dimmed.position.set(crop.source.x, crop.source.y);
    dimmed.width = crop.source.width;
    dimmed.height = crop.source.height;
    dimmed.tint = 0x94a3b8;
    dimmed.alpha = imageObject.uploadStatus === "uploading" ? 0.22 : 0.42;

    const visible = new Sprite(texture);
    visible.position.set(crop.source.x, crop.source.y);
    visible.width = crop.source.width;
    visible.height = crop.source.height;
    visible.alpha = imageObject.uploadStatus === "uploading" ? 0.38 : 1;
    const mask = new Graphics()
      .rect(crop.frame.x, crop.frame.y, crop.frame.width, crop.frame.height)
      .fill({ color: 0xffffff });
    visible.mask = mask;
    target.addChild(dimmed, mask, visible);
  }
}
// private drawImageSizeLabel(
//   target: Container,
//   element: Extract<CanvasElement, { type: "image" }>,
//   bounds: Rectangle,
//   center: Point,
//   rotation: number,
//   chromeScale: number,
// ): void {
//   const label = new Container();
//
//   const text = new Text({
//     text: `${Math.round(element.width)} × ${Math.round(element.height)} px`,
//
//     style: {
//       fill: 0xffffff,
//
//       fontFamily: "Inter Variable, Inter, system-ui, sans-serif",
//
//       fontSize: 11,
//
//       fontWeight: "600",
//     },
//   });
//
//   label.scale.set(chromeScale);
//
//   text.anchor.set(0.5);
//
//   const width = text.width + 14;
//
//   const y = bounds.height / (2 * chromeScale) + 18;
//
//   label.addChild(
//     new Graphics().roundRect(-width / 2, y - 11, width, 22, 5).fill({
//       color: 0x18181b,
//
//       alpha: 0.92,
//     }),
//   );
//
//   text.position.set(0, y);
//
//   label.addChild(text);
//
//   label.position.set(center.x, center.y);
//
//   label.rotation = rotation;
//
//   target.addChild(label);
// }
//
