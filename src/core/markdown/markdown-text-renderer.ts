import { HTMLText } from "pixi.js";
import { hasLatexCompileError, latexInlineSvgFor } from "../latex/latex";
import type { TextObject } from "../model";
import { textFontFamily } from "../model/text";
import { MarkdownHtmlCache } from "./markdown-html-cache.ts";
import { CanvasMarkdownParser } from "./markdown-parser";

export interface MarkdownTextSize {
  width: number;
  height: number;
}

export class MarkdownTextRenderer {
  private readonly parser: CanvasMarkdownParser;
  private readonly htmlCache: MarkdownHtmlCache;
  private readonly measurements = new Map<string, { key: string; size: MarkdownTextSize }>();

  constructor(parser?: CanvasMarkdownParser) {
    this.parser =
      parser ?? new CanvasMarkdownParser((source, unmatched) => this.renderMath(source, unmatched));
    this.htmlCache = new MarkdownHtmlCache(this.parser);
  }

  create(object: TextObject): HTMLText {
    return new HTMLText({
      text: this.htmlForObject(object),
      style: {
        fill: object.color,
        fontFamily: textFontFamily(object.fontFamily),
        fontSize: object.fontSize,
        fontStyle: object.italic ? "italic" : "normal",
        fontWeight: object.fontWeight(),
        align: object.textAlign,
        lineHeight: object.lineHeight,
        letterSpacing: object.letterSpacing,
        wordWrap: false,
        cssOverrides: this.css(object),
      },
    });
  }

  htmlFor(source: string): string {
    return this.htmlCache.htmlFor(source);
  }

  htmlForObject(object: TextObject): string {
    return this.htmlCache.htmlForObject(object.id, object.text);
  }

  contentKey(object: TextObject): string {
    return JSON.stringify([
      object.text,
      object.format,
      object.color,
      object.fontFamily,
      object.fontSize,
      object.italic,
      object.weight,
      object.textAlign,
      object.lineHeight,
      object.letterSpacing,
      this.htmlCache.revision,
    ]);
  }

  measure(object: TextObject): MarkdownTextSize {
    const key = this.contentKey(object);
    const cached = this.measurements.get(object.id);
    if (cached?.key === key) return { ...cached.size };
    const rendered = this.create(object);
    const size = {
      width: Math.max(80, Math.ceil(rendered.width + object.padding * 2 + 2)),
      height: Math.max(
        Math.ceil(object.lineHeight + object.padding * 2),
        Math.ceil(rendered.height + object.padding * 2),
      ),
    };
    rendered.destroy();
    this.measurements.set(object.id, { key, size });
    return size;
  }

  invalidate(objectId: string): void {
    this.htmlCache.invalidateObject(objectId);
    this.measurements.delete(objectId);
  }

  invalidateMeasurement(objectId: string): void {
    this.measurements.delete(objectId);
  }

  invalidateResolvedLatex(): void {
    this.htmlCache.invalidateResolvedLatex();
    this.measurements.clear();
  }

  dispose(objectId: string): void {
    this.invalidate(objectId);
  }

  prune(activeObjectIds: ReadonlySet<string>): void {
    this.htmlCache.prune(activeObjectIds);
    for (const objectId of this.measurements.keys()) {
      if (!activeObjectIds.has(objectId)) this.measurements.delete(objectId);
    }
  }

  destroy(): void {
    this.htmlCache.clear();
    this.measurements.clear();
  }

  cacheSize(): { parsed: number; measurements: number } {
    const html = this.htmlCache.size();
    return {
      parsed: html.objects + html.sources,
      measurements: this.measurements.size,
    };
  }

  private renderMath(source: string, unmatched: boolean): string {
    const raw = unmatched ? source : `$${source}$`;
    if (unmatched || hasLatexCompileError(source)) {
      return `<span class="canvas-md-math-error">${this.parser.escape(raw)}</span>`;
    }
    const svg = latexInlineSvgFor(source);
    return svg
      ? `<span class="canvas-md-math">${svg}</span>`
      : `<span class="canvas-md-math-pending">${this.parser.escape(raw)}</span>`;
  }

  private css(object: TextObject): string[] {
    const lineHeight = object.lineHeight / Math.max(object.fontSize, 1);
    return [
      "p { margin: 0 0 .35em 0; } p:last-child { margin-bottom: 0; }",
      `h1, h2, h3, h4, h5, h6 { margin: 0 0 .28em 0; line-height: ${lineHeight}; font-weight: 700; }`,
      "h1 { font-size: 1.7em; } h2 { font-size: 1.45em; } h3 { font-size: 1.25em; }",
      "ul, ol { margin: 0 0 .35em 0; padding-left: 1.35em; } li { margin: .08em 0; }",
      "code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: rgba(100,116,139,.13); padding: .08em .25em; border-radius: .22em; }",
      "pre { margin: 0 0 .35em 0; padding: .55em .7em; background: rgba(100,116,139,.13); border-radius: .35em; white-space: pre; }",
      "pre code { padding: 0; background: transparent; }",
      ".canvas-md-link { color: #2563eb; text-decoration: underline; }",
      ".canvas-md-math { display: inline-flex; vertical-align: -.15em; }",
      ".canvas-md-math svg { color: currentColor; fill: currentColor; }",
      ".canvas-md-math-pending { color: #64748b; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }",
      ".canvas-md-math-error { color: #dc2626; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }",
    ];
  }
}

export const markdownTextRenderer = new MarkdownTextRenderer();
