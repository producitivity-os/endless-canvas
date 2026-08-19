import {
  Application,
  Container,
  Graphics,
} from "pixi.js";

import type {
  BoardDrag,
  BoardTool,
  CanvasCard,
  DetailDrag,
  DetailTool,
  LinkHead,
  LinkRouting,
} from "../types";

import type {
  CanvasElement,
  Point,
  TextVariant,
  TextElementInit,
} from "../model";

import {
  CanvasLink,
  createTextElement,
} from "../model";



export type LinkMode = {
  routing: LinkRouting;
  fromId: string;
  startHead: LinkHead;
  endHead: LinkHead;
  fromAnchor: Point;
};

export type ImageCropEdit = {
  elementId: string;
  region: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type BoardRuntimeState = {
  tool: BoardTool;
  interactionMode: "canvas" | "annotate";
  drawing: boolean;
  drag: BoardDrag | null;

  linkMode: LinkMode | null;
  hoveredLinkId: string;
  linkHoverCardId: string;

  dragMutationPending: boolean;
};

export type DetailRuntimeState = {
  drag: DetailDrag | null;

  hoveredElementId: string;
  hoveredArrowId: string;

  cropEdit: ImageCropEdit | null;

  tool: DetailTool;
  shapeTool: "rect" | "ellipse";
  textVariant: TextVariant;

  scale: number;
  origin: Point;
};

export class CanvasScene {
  readonly app: Application;

  readonly grid = new Graphics();
  readonly boardViewport = new Container();

  readonly linkLayer = new Graphics();
  readonly drawPreview = new Graphics();

  readonly detailLayer = new Container();
  readonly menuLayer = new Container();

  detailCanvasViewport: Container | null = null;
  detailGridGraphics: Graphics | null = null;

  readonly canvas: HTMLCanvasElement;

  private constructor(app: Application) {
    this.app = app;
    this.canvas = app.canvas;

    this.canvas.className = "pixi-canvas";
    this.canvas.tabIndex = 0;
    this.canvas.style.visibility = "hidden";

    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = this.app.screen;

    this.boardViewport.sortableChildren = true;

    this.linkLayer.zIndex = 20;
    this.drawPreview.zIndex = 30;

    this.boardViewport.addChild(
      this.linkLayer,
      this.drawPreview,
    );

    this.app.stage.addChild(
      this.grid,
      this.boardViewport,
      this.detailLayer,
      this.menuLayer,
    );
  }

  static async create(
    host: HTMLElement,
  ): Promise<CanvasScene> {
    const app = new Application();

    await app.init({
      antialias: true,
      autoDensity: true,
      background: "#f4f6f8",
      preference: "webgl",
      resizeTo: host,
      resolution: Math.min(
        2,
        window.devicePixelRatio || 1,
      ),
    });

    const scene = new CanvasScene(app);

    host.prepend(scene.canvas);

    return scene;
  }

  setCursor(cursor: string): void {
    this.canvas.style.cursor = cursor;
  }

  clearCursor(): void {
    this.canvas.style.cursor = "";
  }

  focus(): void {
    this.canvas.focus();
  }

  show(): void {
    this.canvas.style.visibility = "visible";
  }

  clearDrawPreview(): void {
    this.drawPreview.clear();
  }

  destroy(): void {
    this.app.destroy(true);
  }
}


export function translateElement(
  element: CanvasElement,
  dx: number,
  dy: number,
): void {
  if (element.type === "path") {
    for (const point of element.points) {
      point.x += dx;
      point.y += dy;
    }

    return;
  }

  element.x += dx;
  element.y += dy;
}

