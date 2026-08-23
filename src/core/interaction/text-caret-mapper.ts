import type { CanvasPoint } from "../types";
import type { CanvasTextEditRequest } from "./inline-text-editor";
import type { CanvasTextEditorStyle, CanvasTextSize } from "./text-metrics";

export class CanvasTextCaretMapper {
  private readonly context: CanvasRenderingContext2D;

  constructor() {
    const context = document.createElement("canvas").getContext("2d");
    if (!context) {
      throw new Error("Canvas text measurement is unavailable.");
    }
    this.context = context;
  }

  indexAt(
    value: string,
    point: CanvasPoint,
    request: CanvasTextEditRequest,
    size: CanvasTextSize,
  ): number {
    const width = size.width * request.scale;
    const height = size.height * request.scale;
    const center = { x: request.point.x + width / 2, y: request.point.y + height / 2 };
    const cosine = Math.cos(-request.rotation);
    const sine = Math.sin(-request.rotation);
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const local = {
      x: (width / 2 + dx * cosine - dy * sine) / request.scale,
      y: (height / 2 + dx * sine + dy * cosine) / request.scale,
    };
    const lines = value.split("\n");
    const lineIndex = Math.max(
      0,
      Math.min(
        lines.length - 1,
        Math.floor((local.y - request.style.padding) / request.style.lineHeight),
      ),
    );
    const line = lines[lineIndex] ?? "";
    const lineWidth = this.measure(line, request.style);
    const startX =
      request.style.textAlign === "center"
        ? (size.width - lineWidth) / 2
        : request.style.textAlign === "right"
          ? size.width - request.style.padding - lineWidth
          : request.style.padding;
    const targetX = Math.max(0, local.x - startX);
    let column = 0;
    for (; column < line.length; column++) {
      const current = this.measure(line.slice(0, column), request.style);
      const next = this.measure(line.slice(0, column + 1), request.style);
      if (targetX < (current + next) / 2) {
        break;
      }
    }
    const priorLines = lines
      .slice(0, lineIndex)
      .reduce((length, item) => length + item.length + 1, 0);
    return priorLines + column;
  }

  private measure(value: string, style: CanvasTextEditorStyle): number {
    this.context.font = `${style.italic ? "italic " : ""}${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
    return (
      this.context.measureText(value).width + Math.max(0, value.length - 1) * style.letterSpacing
    );
  }
}
