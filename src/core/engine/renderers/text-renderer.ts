import { Container, Graphics, HTMLText, Text as PixiText } from "pixi.js";
import type { TextObject } from "../../model";
import { textFontFamily } from "../../model/text";
import { markdownTextRenderer } from "../../markdown";
import { theme } from "../theme";
import type { CanvasRenderContext, ElementRenderer } from "./renderer";

interface RetainedTextView {
  root: Container;
  background: Container;
  contentLayer: Container;
  decorations: Container;
  chrome: Container;
  content: HTMLText | PixiText | null;
  contentKey: string;
  format: TextObject["format"] | null;
  objectId: string;
}

function plainTextStyle(object: TextObject) {
  return {
    fill: object.color,
    fontFamily: textFontFamily(object.fontFamily),
    fontSize: object.fontSize,
    fontStyle: object.italic ? ("italic" as const) : ("normal" as const),
    fontWeight: object.fontWeight(),
    align: object.textAlign,
    lineHeight: object.lineHeight,
    letterSpacing: object.letterSpacing,
    wordWrap: object.sizing === "fixed",
    wordWrapWidth: Math.max(1, object.width - object.padding * 2),
    breakWords: object.sizing === "fixed",
  };
}

function textWithinLineLimit(text: string, object: TextObject): boolean {
  const measurement = new PixiText({ text, style: plainTextStyle(object) });
  const fits = measurement.height <= object.lineHeight * (object.maxLines ?? 1) + 0.5;
  measurement.destroy();
  return fits;
}

function truncateToMaxLines(text: string, object: TextObject): string {
  if (!object.maxLines || textWithinLineLimit(text, object)) return text;
  const source = text.replace(/\s+/g, " ").trim();
  let low = 0;
  let high = source.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const candidate = `${source.slice(0, middle).trimEnd()}…`;
    if (textWithinLineLimit(candidate, object)) low = middle;
    else high = middle - 1;
  }
  return `${source.slice(0, low).trimEnd()}…`;
}

export class TextRenderer implements ElementRenderer<TextObject> {
  private readonly views = new WeakMap<Container, RetainedTextView>();

  render(target: Container, textObject: TextObject, context: CanvasRenderContext): void {
    this.reconcile(target, textObject, context);
  }

  reconcile(target: Container, textObject: TextObject, context: CanvasRenderContext): void {
    const view = this.viewFor(target, textObject.id);
    target.visible = !context.editing;
    if (context.editing) return;

    this.updateTransform(view.root, textObject);
    this.updateBackground(view, textObject);
    this.updateContent(view, textObject);
    this.updateDecorations(view, textObject);
    this.updateChrome(view, textObject, context);
  }

  dispose(target: Container, objectId: string): void {
    const view = this.views.get(target);
    if (view?.format === "markdown") markdownTextRenderer.dispose(objectId);
    this.views.delete(target);
  }

  private viewFor(target: Container, objectId: string): RetainedTextView {
    const retained = this.views.get(target);
    if (retained) return retained;
    const root = new Container();
    const view: RetainedTextView = {
      root,
      background: new Container(),
      contentLayer: new Container(),
      decorations: new Container(),
      chrome: new Container(),
      content: null,
      contentKey: "",
      format: null,
      objectId,
    };
    root.addChild(view.background, view.contentLayer, view.decorations, view.chrome);
    target.addChild(root);
    this.views.set(target, view);
    return view;
  }

  private updateTransform(root: Container, object: TextObject): void {
    root.position.set(object.x + object.width / 2, object.y + object.height / 2);
    root.pivot.set(object.width / 2, object.height / 2);
    root.rotation = object.rotation;
    root.alpha = object.opacity;
  }

  private updateBackground(view: RetainedTextView, object: TextObject): void {
    this.clear(view.background);
    const fill = object.backgroundColor ?? object.highlightColor;
    if (fill === undefined && object.borderColor === undefined) return;
    const graphics = new Graphics();
    if (object.cornerRadius > 0) {
      graphics.roundRect(0, 0, object.width, object.height, object.cornerRadius);
    } else {
      graphics.rect(0, 0, object.width, object.height);
    }
    if (fill !== undefined) graphics.fill({ color: fill });
    if (object.borderColor !== undefined && object.borderWidth > 0) {
      graphics.stroke({ color: object.borderColor, width: object.borderWidth });
    }
    view.background.addChild(graphics);
  }

  private updateContent(view: RetainedTextView, object: TextObject): void {
    const contentKey =
      object.format === "markdown"
        ? markdownTextRenderer.contentKey(object, "rendered")
        : JSON.stringify([
            object.text,
            object.color,
            object.fontFamily,
            object.fontSize,
            object.italic,
            object.weight,
            object.textAlign,
            object.lineHeight,
            object.letterSpacing,
            object.sizing,
            object.width,
            object.maxLines,
          ]);
    if (view.contentKey !== contentKey || view.format !== object.format) {
      if (view.content) {
        view.contentLayer.removeChild(view.content);
        view.content.destroy();
      }
      if (view.format === "markdown" && object.format !== "markdown") {
        markdownTextRenderer.dispose(view.objectId);
      }
      view.content =
        object.format === "markdown"
          ? markdownTextRenderer.create(object, "rendered")
          : new PixiText({
              text: truncateToMaxLines(object.text, object),
              style: plainTextStyle(object),
            });
      view.contentLayer.addChild(view.content);
      view.contentKey = contentKey;
      view.format = object.format;
    }

    const content = view.content;
    if (!content) return;
    content.anchor.set(
      object.textAlign === "left" ? 0 : object.textAlign === "right" ? 1 : 0.5,
      object.verticalAlign === "top" ? 0 : object.verticalAlign === "bottom" ? 1 : 0.5,
    );
    content.position.set(
      object.textAlign === "left"
        ? object.padding
        : object.textAlign === "right"
          ? object.width - object.padding
          : object.width / 2,
      object.verticalAlign === "top"
        ? object.padding
        : object.verticalAlign === "bottom"
          ? object.height - object.padding
          : object.height / 2,
    );
  }

  private updateDecorations(view: RetainedTextView, object: TextObject): void {
    this.clear(view.decorations);
    if (!object.underline || object.format !== "plain") return;
    const graphics = new Graphics();
    const lines = object.text.split("\n");
    lines.forEach((line, index) => {
      const measurement = new PixiText({
        text: line || " ",
        style: {
          fontFamily: textFontFamily(object.fontFamily),
          fontSize: object.fontSize,
          fontStyle: object.italic ? "italic" : "normal",
          fontWeight: object.fontWeight(),
          letterSpacing: object.letterSpacing,
        },
      });
      const width = measurement.width;
      measurement.destroy();
      const x =
        object.textAlign === "center"
          ? (object.width - width) / 2
          : object.textAlign === "right"
            ? object.width - object.padding - width
            : object.padding;
      const y = object.padding + (index + 1) * object.lineHeight - 2;
      graphics.moveTo(x, y).lineTo(x + width, y);
    });
    graphics.stroke({ color: object.color, width: Math.max(1, object.fontSize / 16) });
    view.decorations.addChild(graphics);
  }

  private updateChrome(
    view: RetainedTextView,
    object: TextObject,
    context: CanvasRenderContext,
  ): void {
    this.clear(view.chrome);
    if (!context.hovered || context.selected) return;
    const chromeScale = 1 / Math.max(context.scale, 0.001);
    view.chrome.addChild(
      new Graphics().rect(0, 0, object.width, object.height).stroke({
        color: context.interactionColor,
        width: theme.interaction.frameWidth * chromeScale,
      }),
    );
  }

  private clear(container: Container): void {
    for (const child of container.removeChildren()) child.destroy({ children: true });
  }
}
