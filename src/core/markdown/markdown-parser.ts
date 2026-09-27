import MarkdownIt from "markdown-it";
import { markdownInlineMathRanges } from "./markdown-source-model.ts";

interface MarkdownToken {
  content: string;
  markup: string;
  map?: [number, number] | null;
}

interface MarkdownInlineState {
  src: string;
  pos: number;
  posMax: number;
  push(type: string, tag: string, nesting: 0): MarkdownToken;
}

interface MarkdownBlockState {
  src: string;
  bMarks: number[];
  eMarks: number[];
  tShift: number[];
  line: number;
  push(type: string, tag: string, nesting: 0): MarkdownToken;
}

export type MarkdownMathFormatter = (
  source: string,
  unmatched: boolean,
  display: boolean,
  markup?: string,
) => string;

export class CanvasMarkdownParser {
  private readonly markdown: InstanceType<typeof MarkdownIt>;
  private readonly formatMath: MarkdownMathFormatter;

  constructor(formatMath: MarkdownMathFormatter) {
    this.formatMath = formatMath;
    this.markdown = new MarkdownIt({
      html: false,
      linkify: false,
      breaks: true,
      typographer: false,
    });
    this.markdown.block.ruler.before("fence", "math_block", this.readMathBlock);
    this.markdown.inline.ruler.before("escape", "math_inline", this.readMath);
    this.markdown.renderer.rules.math_inline = (tokens: MarkdownToken[], index: number) =>
      this.formatMath(tokens[index].content, false, false, tokens[index].markup);
    this.markdown.renderer.rules.math_error = (tokens: MarkdownToken[], index: number) =>
      this.formatMath(tokens[index].content, true, false, tokens[index].markup);
    this.markdown.renderer.rules.math_block = (tokens: MarkdownToken[], index: number) =>
      `<div class="canvas-md-math-block">${this.formatMath(tokens[index].content, false, true, tokens[index].markup)}</div>\n`;
    this.markdown.renderer.rules.math_block_error = (tokens: MarkdownToken[], index: number) =>
      `<div class="canvas-md-math-block">${this.formatMath(tokens[index].content, true, true, tokens[index].markup)}</div>\n`;
    this.markdown.renderer.rules.link_open = () => '<span class="canvas-md-link">';
    this.markdown.renderer.rules.link_close = () => "</span>";
  }

  render(source: string): string {
    return this.markdown.render(source);
  }

  renderInline(source: string): string {
    return this.markdown.renderInline(source);
  }

  escape(source: string): string {
    return this.markdown.utils.escapeHtml(source);
  }

  private readonly readMath = (state: MarkdownInlineState, silent: boolean): boolean => {
    const dollar = state.src[state.pos] === "$" && state.src[state.pos + 1] !== "$";
    const parenthesized = state.src.startsWith("\\(", state.pos);
    if (!dollar && !parenthesized) return false;
    const range = markdownInlineMathRanges(state.src.slice(0, state.posMax)).find(
      (candidate) => candidate.start === state.pos,
    );
    if (!range) return false;
    if (range.closed) {
      if (!silent) {
        const token = state.push("math_inline", "math", 0);
        token.content = range.content;
        token.markup = parenthesized ? "\\(" : "$";
      }
      state.pos = range.end;
      return true;
    }
    if (!silent) {
      const token = state.push("math_error", "math", 0);
      token.content = range.source;
      token.markup = parenthesized ? "\\(" : "$";
    }
    state.pos = range.end;
    return true;
  };

  private readonly readMathBlock = (
    state: MarkdownBlockState,
    startLine: number,
    endLine: number,
    silent: boolean,
  ): boolean => {
    const start = state.bMarks[startLine] + state.tShift[startLine];
    const firstLine = state.src.slice(start, state.eMarks[startLine]);
    const opening = firstLine.startsWith("$$")
      ? "$$"
      : firstLine.startsWith("\\[")
        ? "\\["
        : null;
    if (!opening) return false;
    const closing = opening === "$$" ? "$$" : "\\]";
    if (silent) return true;

    const openingRemainder = firstLine.slice(opening.length);
    const sameLineClose = openingRemainder.indexOf(closing);
    let content = "";
    let nextLine = startLine + 1;
    let closed =
      sameLineClose >= 0 && openingRemainder.slice(sameLineClose + 2).trim().length === 0;

    if (closed) {
      content = openingRemainder.slice(0, sameLineClose);
    } else {
      const lines = [openingRemainder];
      for (; nextLine < endLine; nextLine += 1) {
        const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
        const line = state.src.slice(lineStart, state.eMarks[nextLine]);
        const close = line.indexOf(closing);
        if (close >= 0 && line.slice(close + closing.length).trim().length === 0) {
          lines.push(line.slice(0, close));
          closed = true;
          nextLine += 1;
          break;
        }
        lines.push(line);
      }
      content = closed
        ? lines.join("\n")
        : state.src.slice(start, state.eMarks[Math.max(startLine, endLine - 1)]);
    }

    const token = state.push(closed ? "math_block" : "math_block_error", "math", 0);
    token.content = closed ? content.trim() : content;
    token.markup = opening;
    token.map = [startLine, closed ? nextLine : endLine];
    state.line = closed ? nextLine : endLine;
    return true;
  };
}
