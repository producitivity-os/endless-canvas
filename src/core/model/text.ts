import { Container, Graphics, Sprite, Text, TextStyle, type Texture } from "pixi.js";
import { Element } from "./entities";
import type { BaseElement, CanvasCard, EditState, Point } from "./model";

export type TextFont = "inter" | "serif" | "mono" | "rounded";
export type TextVariant = "body" | "heading" | "caption" | "latex";
export type TextWeight = "regular" | "bold" | "extrabold";
export type TextElementInit = BaseElement & {
  text?: string;
  fontSize?: number;
  color?: number;
  variant?: TextVariant;
  textAlign?: "left" | "center" | "right";
  verticalAlign?: "top" | "center" | "bottom";
  overflow?: "ellipsis";
  singleLine?: boolean;
  fontFamily?: TextFont;
  opacity?: number;
  padding?: number;
  bold?: boolean;
  weight?: TextWeight;
  italic?: boolean;
  underline?: boolean;
  highlightColor?: number;
};

export class BaseTextElement extends Element {
  readonly type = "text" as const;
  text: string;
  fontSize: number;
  color: number;
  variant: TextVariant;
  textAlign: "left" | "center" | "right";
  verticalAlign: "top" | "center" | "bottom";
  overflow?: "ellipsis";
  singleLine: boolean;
  fontFamily: TextFont;
  opacity: number;
  padding: number;
  weight: TextWeight;
  italic: boolean;
  underline: boolean;
  highlightColor?: number;

  constructor(init: TextElementInit) {
    super(init);
    this.text = init.text ?? "";
    this.fontSize = init.fontSize ?? 18;
    this.color = init.color ?? 0x1f2530;
    this.variant = init.variant ?? "body";
    this.textAlign = init.textAlign ?? "left";
    this.verticalAlign = init.verticalAlign ?? "center";
    this.overflow = init.overflow;
    this.singleLine = init.singleLine ?? true;
    this.fontFamily = init.fontFamily ?? "inter";
    this.opacity = init.opacity ?? 1;
    this.padding = init.padding ?? 4;
    this.weight = init.weight ?? (init.bold || this.variant === "heading" ? "bold" : "regular");
    this.italic = init.italic ?? false;
    this.underline = init.underline ?? false;
    this.highlightColor = init.highlightColor;
  }

  displayedFontSize() { return this.variant === "latex" ? this.fontSize * 0.82 : this.fontSize; }
  renderingMode() { return this.variant === "latex" ? ("latex" as const) : ("text" as const); }
  fontWeight() { return this.weight === "extrabold" ? ("800" as const) : this.weight === "bold" ? ("700" as const) : ("400" as const); }
  get bold() { return this.weight !== "regular"; }
  set bold(enabled: boolean) { this.weight = enabled ? "bold" : "regular"; }
  rightPadding() { return this.padding + 4; }
  selectionAppearance() { return { color: 0x4f7fe8, frameWidth: 1.75, handleSize: 9, handleWidth: 2 }; }
}

export class TextElement extends BaseTextElement {}

export function createTextElement(init: TextElementInit) {
  return new TextElement(init);
}

export const textPrimary = 0x161922;
export const textSecondary = 0x4d5565;
export const textCardHeight = 52;
export const minTextCardWidth = 80;
export const textCardHorizontalPadding = 12;

export function textFontFamily(font: TextFont) {
  if (font === "serif") return "Georgia, 'Times New Roman', serif";
  if (font === "mono") return "'SFMono-Regular', Consolas, 'Liberation Mono', monospace";
  if (font === "rounded") return "ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', sans-serif";
  return "Inter Variable, Inter, system-ui, sans-serif";
}

export function wrapText(value: string, maxChars: number) {
  const output: string[] = [];
  for (const sourceLine of value.split("\n")) { const words = sourceLine.split(/\s+/).filter(Boolean); let line = ""; for (const word of words) { const next = line ? `${line} ${word}` : word; if (next.length > maxChars && line) { output.push(line); line = word; } else line = next; } output.push(line); }
  return output.join("\n");
}

export function textStyle(element: BaseTextElement, fill = element.color) {
  return new TextStyle({ fill, fontFamily: textFontFamily(element.fontFamily), fontSize: element.fontSize, fontStyle: element.italic ? "italic" : "normal", fontWeight: element.fontWeight(), lineHeight: Math.round(element.fontSize * 1.35), wordWrap: !element.singleLine, wordWrapWidth: element.width, align: element.textAlign ?? "left" });
}

export function pixiTextWidth(element: BaseTextElement, value: string) { if (!value) return 0; const measurement = new Text({ text: value, style: textStyle(element) }); const width = measurement.width; measurement.destroy(); return width; }
export function ellipsizeText(value: string, width: number, fontSize: number) { const line = value.replace(/\s*\n+\s*/g, " "); const count = Math.max(1, Math.floor(width / (fontSize * 0.58))); return line.length <= count ? line : `${line.slice(0, Math.max(1, count - 1)).trimEnd()}…`; }

export function textCardElement(card: CanvasCard) {
  const element = card.elements.length === 1 && card.elements[0]?.type === "text" ? card.elements[0] : null;
  return card.kind === "text" || element?.textAlign === "center" ? element : null;
}

export function syncTextCardBounds(card: CanvasCard, verticalPadding: number) {
  const element = textCardElement(card);
  if (!element) return;
  element.x = textCardHorizontalPadding;
  element.y = verticalPadding;
  element.width = Math.max(40, card.width - textCardHorizontalPadding * 2);
  element.height = Math.max(16, card.height - verticalPadding * 2);
  element.singleLine = true;
  element.overflow = card.textSizing === "custom" ? "ellipsis" : undefined;
}

export function fitTextCardToContent(card: CanvasCard, verticalPadding: number) {
  const element = textCardElement(card);
  if (!element) return false;
  const value = element.text.replace(/\s*\n+\s*/g, " ");
  const contentWidth = pixiTextWidth(element, value || "Type…");
  card.width = Math.max(minTextCardWidth, Math.min(900, Math.ceil(contentWidth + textCardHorizontalPadding * 2)));
  card.height = textCardHeight;
  syncTextCardBounds(card, verticalPadding);
  return true;
}

export type LatexTextMeasurement = {
  textureFor(source: string): Texture | null;
  renderedSize(element: BaseTextElement, texture: Texture): { width: number; height: number };
};

export function fitIllustrationTextToContent(
  element: BaseTextElement,
  latex: LatexTextMeasurement,
  measureLatexSource = false,
) {
  const value = element.text.replace(/\s*\n+\s*/g, " ");
  if (element.variant === "latex" && value && !measureLatexSource) {
    const texture = latex.textureFor(value);
    if (texture) {
      const rendered = latex.renderedSize(element, texture);
      element.width = Math.max(40, rendered.width + element.padding + element.rightPadding());
      element.height = Math.max(16, Math.ceil(rendered.height + element.padding * 2));
      return;
    }
  }
  const contentWidth = pixiTextWidth(element, value || "Type…");
  element.width = Math.max(40, Math.min(1200, Math.ceil(contentWidth + element.padding + element.rightPadding())));
  element.height = Math.ceil(element.displayedFontSize() * 1.35 + element.padding * 2);
}

export function singleLineTextMetrics(element: BaseTextElement, value: string, index: number) {
  const normalized = value.replace(/\s*\n+\s*/g, " ");
  const fullWidth = pixiTextWidth(element, normalized);
  const prefix = normalized.slice(0, Math.max(0, Math.min(normalized.length, index)));
  const prefixWidth = pixiTextWidth(element, prefix);
  const contentWidth = element.width - element.padding - element.rightPadding();
  const startX = element.textAlign === "center"
    ? element.x + element.padding + (contentWidth - fullWidth) / 2
    : element.textAlign === "right"
      ? element.x + element.width - element.rightPadding() - fullWidth
      : element.x + element.padding;
  const lineHeight = element.displayedFontSize() * 1.35;
  const y = element.verticalAlign === "top"
    ? element.y + element.padding
    : element.verticalAlign === "bottom"
      ? element.y + element.height - element.padding - lineHeight
      : element.y + (element.height - lineHeight) / 2;
  return { x: startX + prefixWidth, y, lineHeight, startX, fullWidth };
}

export function textIndexAtPoint(element: BaseTextElement, value: string, point: Point) {
  const normalized = value.replace(/\s*\n+\s*/g, " ");
  let low = 0;
  let high = normalized.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (singleLineTextMetrics(element, normalized, middle).x < point.x) low = middle + 1;
    else high = middle;
  }
  if (low === 0) return 0;
  const before = singleLineTextMetrics(element, normalized, low - 1).x;
  const after = singleLineTextMetrics(element, normalized, low).x;
  return Math.abs(point.x - before) <= Math.abs(after - point.x) ? low - 1 : low;
}

export function detailTextBoxHeight(variant: TextVariant) {
  const fontSize = variant === "heading" ? 28 : variant === "caption" ? 14 : 18;
  return Math.ceil(fontSize * 1.35) + 8;
}

export function selectedText(editor: EditState | null) {
  if (!editor) return "";
  const start = Math.min(editor.anchor, editor.cursor);
  const end = Math.max(editor.anchor, editor.cursor);
  return editor.value.slice(start, end);
}

export function replaceTextSelection(editor: EditState, element: BaseTextElement | null, text: string) {
  const start = Math.min(editor.anchor, editor.cursor);
  const end = Math.max(editor.anchor, editor.cursor);
  const inserted = element?.singleLine ? text.replace(/\s*\n+\s*/g, " ") : text;
  editor.value = `${editor.value.slice(0, start)}${inserted}${editor.value.slice(end)}`;
  editor.cursor = start + inserted.length;
  editor.anchor = editor.cursor;
  if (element) element.text = editor.value;
}

export function moveTextCursor(editor: EditState, next: number, selecting: boolean) {
  editor.cursor = Math.max(0, Math.min(editor.value.length, next));
  if (!selecting) editor.anchor = editor.cursor;
}

export function drawTextElement(
  target: Container,
  element: BaseTextElement,
  editing: EditState | null | undefined,
  latex: LatexTextMeasurement & { hasCompileError(source: string): boolean },
) {
  const rotation = element.rotation ?? 0;
  const isEditing = editing?.elementId === element.id;
  const sourceText = isEditing ? editing.value : element.text;
  const padding = element.padding;
  const rightPadding = element.rightPadding();
  const contentWidth = Math.max(1, element.width - padding - rightPadding);
  const contentCenterX = element.x + padding + contentWidth / 2;
  if (element.renderingMode() === "latex" && !isEditing) {
    const texture = latex.textureFor(sourceText);
    if (texture) {
      const sprite = new Sprite(texture);
      const rendered = latex.renderedSize(element, texture);
      sprite.width = rendered.width;
      sprite.height = rendered.height;
      sprite.tint = element.color;
      sprite.alpha = element.opacity;
      sprite.position.set(contentCenterX, element.y + element.height / 2);
      sprite.anchor.set(0.5);
      sprite.rotation = rotation;
      target.addChild(sprite);
      return;
    }
  }
  const renderedText = element.overflow === "ellipsis"
    ? ellipsizeText(sourceText, contentWidth, element.fontSize)
    : element.singleLine
      ? sourceText.replace(/\s*\n+\s*/g, " ")
      : sourceText;
  const node = new Text({
    text: element.singleLine ? renderedText : wrapText(renderedText, Math.max(8, Math.floor(contentWidth / 8))),
    style: textStyle(element, element.renderingMode() === "latex" && latex.hasCompileError(sourceText) ? 0xdc2626 : element.color),
  });
  if (element.singleLine) {
    node.anchor.set(element.textAlign === "left" ? 0 : element.textAlign === "right" ? 1 : 0.5, element.verticalAlign === "top" ? 0 : element.verticalAlign === "bottom" ? 1 : 0.5);
    node.position.set(element.textAlign === "left" ? element.x + padding : element.textAlign === "right" ? element.x + element.width - rightPadding : contentCenterX, element.verticalAlign === "top" ? element.y + padding : element.verticalAlign === "bottom" ? element.y + element.height - padding : element.y + element.height / 2);
  } else {
    node.position.set(element.x + element.width / 2, element.y + element.height / 2);
    if (element.textAlign === "center") node.anchor.set(0.5);
    else node.pivot.set(element.width / 2, element.height / 2);
  }
  node.rotation = rotation;
  node.alpha = element.opacity;
  if (element.highlightColor !== undefined && renderedText) {
    const highlight = new Graphics();
    const width = Math.min(contentWidth, Math.max(12, node.width));
    const startX = element.textAlign === "center" ? element.x + (element.width - width) / 2 : element.textAlign === "right" ? element.x + element.width - rightPadding - width : element.x + padding;
    const centerY = element.y + element.height / 2 + element.displayedFontSize() * 0.16;
    const seed = [...element.id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
    const thickness = Math.max(7, element.displayedFontSize() * 0.72);
    for (let pass = 0; pass < 3; pass += 1) {
      const jitter = ((seed + pass * 7) % 5 - 2) * 0.45;
      highlight.moveTo(startX - 2, centerY + jitter).lineTo(startX + width * 0.34, centerY - jitter * 0.7).lineTo(startX + width * 0.7, centerY + jitter * 0.5).lineTo(startX + width + 2, centerY - jitter).stroke({ color: element.highlightColor, width: thickness / 3, alpha: 0.24, cap: "round", join: "round" });
    }
    highlight.position.set(element.x + element.width / 2, element.y + element.height / 2);
    highlight.pivot.set(element.x + element.width / 2, element.y + element.height / 2);
    highlight.rotation = rotation;
    target.addChild(highlight);
  }
  target.addChild(node);
  if (element.underline && renderedText) {
    const underlineStartX = element.textAlign === "center" ? contentCenterX - node.width / 2 : element.textAlign === "right" ? element.x + element.width - rightPadding - node.width : element.x + padding;
    const textTop = element.verticalAlign === "top" ? element.y + padding : element.verticalAlign === "bottom" ? element.y + element.height - padding - node.height : element.y + (element.height - node.height) / 2;
    target.addChild(new Graphics().moveTo(underlineStartX, textTop + node.height - 1).lineTo(underlineStartX + node.width, textTop + node.height - 1).stroke({ color: element.color, width: Math.max(1, element.fontSize / 14), alpha: element.opacity }));
  }
}
