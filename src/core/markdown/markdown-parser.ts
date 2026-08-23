import MarkdownIt from "markdown-it";

interface MarkdownToken {
  content: string;
  markup: string;
}

interface MarkdownInlineState {
  src: string;
  pos: number;
  posMax: number;
  push(type: string, tag: string, nesting: 0): MarkdownToken;
}

export type MarkdownMathFormatter = (source: string, unmatched: boolean) => string;

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
    this.markdown.inline.ruler.before("escape", "math_inline", this.readMath);
    this.markdown.renderer.rules.math_inline = (tokens: MarkdownToken[], index: number) =>
      this.formatMath(tokens[index].content, false);
    this.markdown.renderer.rules.math_error = (tokens: MarkdownToken[], index: number) =>
      this.formatMath(tokens[index].content, true);
    this.markdown.renderer.rules.link_open = () => '<span class="canvas-md-link">';
    this.markdown.renderer.rules.link_close = () => "</span>";
  }

  render(source: string): string {
    return this.markdown.render(source);
  }

  escape(source: string): string {
    return this.markdown.utils.escapeHtml(source);
  }

  private readonly readMath = (state: MarkdownInlineState, silent: boolean): boolean => {
    if (state.src[state.pos] !== "$" || state.src[state.pos + 1] === "$") return false;
    const start = state.pos;
    let cursor = start + 1;
    while (cursor < state.posMax) {
      if (state.src[cursor] === "\n") break;
      if (state.src[cursor] === "$" && state.src[cursor - 1] !== "\\") {
        if (!silent) {
          const token = state.push("math_inline", "math", 0);
          token.content = state.src.slice(start + 1, cursor);
          token.markup = "$";
        }
        state.pos = cursor + 1;
        return true;
      }
      cursor++;
    }
    if (!silent) {
      const token = state.push("math_error", "math", 0);
      token.content = state.src.slice(start);
      token.markup = "$";
    }
    state.pos = cursor;
    return true;
  };
}
