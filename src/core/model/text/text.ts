import { CanvasObject, type CanvasObjectInit } from "../object.ts";

export type TextFont = "inter" | "serif" | "mono" | "rounded";
export type TextVariant = "body" | "heading" | "caption" | "latex";
export type TextWeight = "regular" | "bold" | "extrabold";
export type TextFormat = "plain" | "markdown";

export type TextObjectInit = CanvasObjectInit & {
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
  lineHeight?: number;
  letterSpacing?: number;
  format?: TextFormat;
};

export class BaseTextObject extends CanvasObject {
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
  lineHeight: number;
  letterSpacing: number;
  format: TextFormat;

  constructor(init: TextObjectInit) {
    super(init);
    this.text = init.text ?? "";
    this.fontSize = init.fontSize ?? 18;
    this.color = init.color ?? 0x1f2530;
    this.variant = init.variant ?? "body";
    this.textAlign = init.textAlign ?? "left";
    this.verticalAlign = init.verticalAlign ?? "top";
    this.overflow = init.overflow;
    this.singleLine = init.singleLine ?? false;
    this.fontFamily = init.fontFamily ?? "inter";
    this.opacity = init.opacity ?? 1;
    this.padding = init.padding ?? 4;
    this.weight = init.weight ?? (init.bold || this.variant === "heading" ? "bold" : "regular");
    this.italic = init.italic ?? false;
    this.underline = init.underline ?? false;
    this.highlightColor = init.highlightColor;
    this.lineHeight = init.lineHeight ?? Math.round(this.fontSize * 1.35);
    this.letterSpacing = init.letterSpacing ?? 0;
    this.format = init.format ?? "plain";
    this.id = init.id;
  }

  displayedFontSize() {
    return this.variant === "latex" ? this.fontSize * 0.82 : this.fontSize;
  }
  renderingMode() {
    return this.variant === "latex" ? ("latex" as const) : ("text" as const);
  }
  fontWeight() {
    return this.weight === "extrabold"
      ? ("800" as const)
      : this.weight === "bold"
        ? ("700" as const)
        : ("400" as const);
  }
  get bold() {
    return this.weight !== "regular";
  }
  set bold(enabled: boolean) {
    this.weight = enabled ? "bold" : "regular";
  }
  rightPadding() {
    return this.padding + 4;
  }
  selectionAppearance() {
    return { color: 0x4f7fe8, frameWidth: 1.75, handleSize: 9, handleWidth: 2 };
  }
}

export class TextObject extends BaseTextObject {}
