import { HTMLText } from "pixi.js";
import { hasLatexCompileError, latexInlineSvgFor } from "../latex/latex";
import type { TextObject } from "../model";
import { textFontFamily } from "../model/text";
import { MarkdownHtmlCache } from "./markdown-html-cache.ts";
import { CanvasMarkdownParser } from "./markdown-parser";
import { markdownBlockCss, markdownTypography } from "./markdown-typography.ts";

export interface MarkdownTextSize {
  width: number;
  height: number;
}
export type MarkdownRenderMode = "source" | "rendered";

export class MarkdownTextRenderer {
  private readonly parser: CanvasMarkdownParser;
  private readonly htmlCache: MarkdownHtmlCache;
  private readonly measurements = new Map<string, { key: string; size: MarkdownTextSize }>();

  constructor(parser?: CanvasMarkdownParser) {
    this.parser =
      parser ??
      new CanvasMarkdownParser((source, unmatched, display) =>
        this.renderMath(source, unmatched, display),
      );
    this.htmlCache = new MarkdownHtmlCache(this.parser);
  }

  get revision(): number {
    return this.htmlCache.revision;
  }

  create(object: TextObject, mode: MarkdownRenderMode = "rendered"): HTMLText {
    const rendered = mode === "rendered";

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

        // Only constrain/wrap using the textbox size in source mode.
        wordWrap: !rendered && object.sizing === "fixed",
        wordWrapWidth: Math.max(1, object.width - object.padding * 2),
        breakWords: !rendered && object.sizing === "fixed",

        cssOverrides: this.css(rendered),
      },
    });
  }

  htmlFor(source: string): string {
    return this.htmlCache.htmlFor(source);
  }

  htmlForInline(source: string): string {
    return this.parser.renderInline(source);
  }

  htmlForObject(object: TextObject): string {
    return this.htmlCache.htmlForObject(object.id, object.text);
  }

  htmlForInlineMath(source: string): string {
    return this.renderMath(source, false);
  }

  contentKey(object: TextObject, mode: MarkdownRenderMode = "rendered"): string {
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
      object.padding,
      mode,

      // Only source mode depends on the manually chosen textbox dimensions.
      mode === "source" ? object.sizing : null,
      mode === "source" ? object.width : null,
      mode === "source" ? object.minHeight : null,

      this.htmlCache.revision,
    ]);
  }

  measure(object: TextObject, mode: MarkdownRenderMode = "rendered"): MarkdownTextSize {
    const key = this.contentKey(object, mode);
    const cached = this.measurements.get(object.id);

    if (cached?.key === key) {
      return { ...cached.size };
    }

    const rendered = this.create(object, mode);

    const size =
      mode === "rendered"
        ? {
            width: Math.ceil(rendered.width + object.padding * 2),
            height: Math.ceil(rendered.height + object.padding * 2),
          }
        : {
            width:
              object.sizing === "fixed"
                ? object.width
                : Math.ceil(rendered.width + object.padding * 2),

            height: Math.max(object.minHeight, Math.ceil(rendered.height + object.padding * 2)),
          };

    rendered.destroy();

    this.measurements.set(object.id, {
      key,
      size,
    });

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

  private renderMath(source: string, unmatched: boolean, display = false, markup?: string): string {
    const opening = markup ?? (display ? "$$" : "$");
    const closing = opening === "\\(" ? "\\)" : opening === "\\[" ? "\\]" : opening;
    const raw = unmatched ? source : `${opening}${source}${closing}`;
    if (unmatched || hasLatexCompileError(source)) {
      return `<span class="canvas-md-math-error">${this.parser.escape(raw)}</span>`;
    }
    const svg = latexInlineSvgFor(source);
    return svg
      ? `<span class="canvas-md-math">${svg}</span>`
      : `<span class="canvas-md-math-pending">${this.parser.escape(raw)}</span>`;
  }

  private css(rendered: boolean): string[] {
    return [
      ...markdownBlockCss(),
      ".canvas-md-link { color: #2563eb; text-decoration: underline; }",
      ".canvas-md-math { display: inline-flex; vertical-align: -.15em; }",
      ".canvas-md-math svg { color: currentColor; fill: currentColor; }",

      `.canvas-md-math-block {
      display: flex;
      ${rendered ? "width: max-content; overflow: visible;" : "max-width: 100%; overflow: hidden;"}
      margin: ${markdownTypography.displayMathMargin};
    }`,

      `.canvas-md-math-block .canvas-md-math {
      ${rendered ? "max-width: none;" : "max-width: 100%;"}
    }`,

      `.canvas-md-math-block svg {
      ${rendered ? "max-width: none;" : "max-width: 100%;"}
      height: auto;
    }`,

      ".canvas-md-math-pending { color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', system-ui, sans-serif; }",
      ".canvas-md-math-error { color: #dc2626; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', system-ui, sans-serif; }",
    ];
  }
}

export const markdownTextRenderer = new MarkdownTextRenderer();
