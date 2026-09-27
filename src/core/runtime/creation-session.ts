import {
  DiamondObject,
  EllipseObject,
  ParallelogramObject,
  PathObject,
  RectangleObject,
  PentagonObject,
  TextObject,
  type TextFormat,
  TextCard,
  MarkdownCard,
  type CanvasObject,
} from "../model";
import { CanvasPropertyDefaults } from "../properties";
import type { CanvasCreationPreview, CanvasPoint, CanvasTool } from "../types";

export type CanvasCreationTool = Extract<
  CanvasTool,
  | "card"
  | "markdown-card"
  | "text"
  | "markdown"
  | "rect"
  | "ellipse"
  | "diamond"
  | "pentagon"
  | "parallelogram"
  | "pencil"
>;

export class CanvasCreationSession {
  private readonly defaults: CanvasPropertyDefaults;
  private activeTool: CanvasCreationTool | null = null;
  private points: CanvasPoint[] = [];

  constructor(defaults: CanvasPropertyDefaults | TextFormat = new CanvasPropertyDefaults()) {
    this.defaults =
      typeof defaults === "string"
        ? new CanvasPropertyDefaults({ text: { format: defaults } })
        : defaults;
  }

  get active(): boolean {
    return this.activeTool !== null;
  }

  begin(tool: CanvasCreationTool, point: CanvasPoint): void {
    this.activeTool = tool;
    this.points = [{ ...point }];
  }

  update(point: CanvasPoint): void {
    if (!this.activeTool) {
      return;
    }

    if (this.activeTool === "pencil") {
      const previous = this.points[this.points.length - 1];
      if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= 1.5) {
        this.points.push({ ...point });
      }
      return;
    }

    this.points[1] = { ...point };
  }

  preview(): CanvasCreationPreview | null {
    const tool = this.activeTool;
    const origin = this.points[0];
    if (!tool || !origin) {
      return null;
    }

    if (
      tool === "card" ||
      tool === "markdown-card" ||
      tool === "text" ||
      tool === "markdown" ||
      tool === "rect" ||
      tool === "ellipse" ||
      tool === "diamond" ||
      tool === "pentagon" ||
      tool === "parallelogram"
    ) {
      return {
        type: "box",
        tool,
        origin: { ...origin },
        current: { ...(this.points[1] ?? origin) },
      };
    }

    return {
      type: "stroke",
      tool,
      points: this.points.map((point) => ({ ...point })),
    };
  }

  finish(): CanvasObject | null {
    const tool = this.activeTool;
    const points = this.points;
    this.cancel();
    if (!tool || !points[0]) {
      return null;
    }

    const start = points[0];
    const end = points[1] ?? start;
    if (tool === "pencil") {
      return this.createPath(
        points.length > 1 ? points : [start, { x: start.x + 1, y: start.y + 1 }],
      );
    }
    return this.createBox(tool, start, end);
  }

  cancel(): void {
    this.activeTool = null;
    this.points = [];
  }

  private createBox(
    tool: Extract<
      CanvasCreationTool,
      | "card"
      | "markdown-card"
      | "text"
      | "markdown"
      | "rect"
      | "ellipse"
      | "diamond"
      | "pentagon"
      | "parallelogram"
    >,
    start: CanvasPoint,
    end: CanvasPoint,
  ): CanvasObject {
    const minimum =
      tool === "card" || tool === "markdown-card"
        ? { width: 80, height: 60 }
        : this.isTextTool(tool)
          ? { width: 80, height: 33 }
          : { width: 48, height: 36 };
    const draggedWidth = Math.abs(end.x - start.x);
    const draggedHeight = Math.abs(end.y - start.y);
    const cardTool = tool === "card" || tool === "markdown-card";
    const defaultsTool = tool === "markdown-card" ? "card" : tool;
    const width =
      draggedWidth < 2
        ? cardTool
          ? 220
          : this.isTextTool(tool)
            ? 240
            : 140
        : Math.max(minimum.width, draggedWidth);
    const height =
      draggedHeight < 2
        ? cardTool
          ? 140
          : this.isTextTool(tool)
            ? 33
            : 100
        : Math.max(minimum.height, draggedHeight);
    const x = draggedWidth < 2 ? start.x : Math.min(start.x, end.x);
    const y = draggedHeight < 2 ? start.y : Math.min(start.y, end.y);
    const common = {
      id: crypto.randomUUID(),
      x,
      y,
      width,
      height,
      rotation: 0,
      opacity: this.defaults.forTool(defaultsTool).opacity ?? 1,
      fill: this.defaults.forTool(defaultsTool).fill ?? 0xffffff,
      stroke: this.defaults.forTool(defaultsTool).stroke ?? 0x64748b,
      strokeWidth: this.defaults.forTool(defaultsTool).strokeWidth ?? 2,
      fillStyle: this.defaults.forTool(defaultsTool).fillStyle ?? ("solid" as const),
    };

    if (this.isTextTool(tool)) {
      const values = this.defaults.forTool(tool);
      return new TextObject({
        id: common.id,
        type: "text",
        x,
        y,
        width,
        height,
        rotation: 0,
        opacity: common.opacity,
        format: values.format ?? (tool === "markdown" ? "markdown" : "plain"),
        color: values.color,
        fontSize: values.fontSize,
        fontFamily: values.fontFamily,
        weight: values.weight,
        italic: values.italic,
        underline: values.underline,
        textAlign: values.textAlign,
        verticalAlign: values.verticalAlign,
        lineHeight: values.lineHeight,
        letterSpacing: values.letterSpacing,
        sizing: "fixed",
        minHeight: height,
        backgroundColor: undefined,
        borderColor: undefined,
        borderWidth: 0,
        cornerRadius: 0,
      });
    }

    if (tool === "card" || tool === "markdown-card") {
      if (tool === "markdown-card") {
        return new MarkdownCard({
          ...common,
          type: "card",
          elements: [],
          markdown: "",
          backgroundColor: this.defaults.forTool("card").backgroundColor,
        });
      }
      return new TextCard({
        ...common,
        type: "card",
        elements: [],
        backgroundColor: this.defaults.forTool(tool).backgroundColor,
      });
    }
    if (tool === "ellipse") {
      return new EllipseObject({
        ...common,
        type: "ellipse",
        arcSweep: this.defaults.forTool(tool).arcSweep,
      });
    }
    if (tool === "diamond") {
      return new DiamondObject({
        ...common,
        type: "diamond",
        waistRatio: this.defaults.forTool(tool).waistRatio,
      });
    }
    if (tool === "pentagon") {
      return new PentagonObject({
        ...common,
        type: "pentagon",
        shoulderRatio: this.defaults.forTool(tool).shoulderRatio,
        apexRatio: this.defaults.forTool(tool).apexRatio,
      });
    }
    if (tool === "parallelogram") {
      return new ParallelogramObject({
        ...common,
        type: "parallelogram",
        slantRatio: this.defaults.forTool(tool).slantRatio,
      });
    }
    return new RectangleObject({
      ...common,
      type: "rect",
      cornerRadius: this.defaults.forTool(tool).cornerRadius,
    });
  }

  private createPath(points: CanvasPoint[]): PathObject {
    const bounds = this.bounds(points);
    const values = this.defaults.forTool("pencil");
    return new PathObject({
      id: crypto.randomUUID(),
      type: "path",
      ...bounds,
      rotation: 0,
      opacity: values.opacity ?? 1,
      points: points.map((point) => ({ ...point })),
      color: values.color ?? 0x334155,
      fill: 0,
      stroke: values.stroke ?? values.color ?? 0x334155,
      strokeWidth: values.strokeWidth ?? 2.5,
      fillStyle: "none",
    });
  }

  private isTextTool(tool: CanvasCreationTool): tool is "text" | "markdown" {
    return tool === "text" || tool === "markdown";
  }

  private bounds(points: CanvasPoint[]): { x: number; y: number; width: number; height: number } {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return {
      x,
      y,
      width: Math.max(1, Math.max(...xs) - x),
      height: Math.max(1, Math.max(...ys) - y),
    };
  }
}
