export interface CanvasTextEditorStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  italic: boolean;
  color: string;
  opacity: number;
  lineHeight: number;
  letterSpacing: number;
  padding: number;
  textAlign: "left" | "center" | "right";
}

export interface CanvasTextSize {
  width: number;
  height: number;
}

export class CanvasTextMetrics {
  private readonly context: CanvasRenderingContext2D;

  constructor() {
    const context = document.createElement("canvas").getContext("2d");
    if (!context) {
      throw new Error("Canvas text measurement is unavailable.");
    }
    this.context = context;
  }

  measure(text: string, style: CanvasTextEditorStyle): CanvasTextSize {
    this.context.font = `${style.italic ? "italic " : ""}${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
    const lines = text.split("\n");
    const contentWidth = Math.max(
      ...lines.map((line) => {
        const value = line || " ";
        return (
          this.context.measureText(value).width +
          Math.max(0, value.length - 1) * style.letterSpacing
        );
      }),
    );
    return {
      width: Math.max(80, Math.ceil(contentWidth + style.padding * 2 + 2)),
      height: Math.max(
        Math.ceil(style.lineHeight + style.padding * 2),
        Math.ceil(lines.length * style.lineHeight + style.padding * 2),
      ),
    };
  }

  measureFixed(text: string, style: CanvasTextEditorStyle, width: number): CanvasTextSize {
    this.context.font = `${style.italic ? "italic " : ""}${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
    const available = Math.max(1, width - style.padding * 2);
    const hardLines = text.split("\n");
    let visualLines = 0;
    for (const hardLine of hardLines) {
      if (!hardLine) {
        visualLines++;
        continue;
      }
      let lineWidth = 0;
      for (const token of hardLine.match(/\S+\s*|\s+/g) ?? [hardLine]) {
        const tokenWidth =
          this.context.measureText(token).width +
          Math.max(0, token.length - 1) * style.letterSpacing;
        if (lineWidth > 0 && lineWidth + tokenWidth > available) {
          visualLines++;
          lineWidth = 0;
        }
        if (tokenWidth <= available) {
          lineWidth += tokenWidth;
          continue;
        }
        const wrapped = Math.max(1, Math.ceil(tokenWidth / available));
        visualLines += wrapped - 1;
        lineWidth = tokenWidth % available;
      }
      visualLines++;
    }
    return {
      width,
      height: Math.max(
        Math.ceil(style.lineHeight + style.padding * 2),
        Math.ceil(visualLines * style.lineHeight + style.padding * 2),
      ),
    };
  }
}
