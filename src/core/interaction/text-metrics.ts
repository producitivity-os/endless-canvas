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
}
