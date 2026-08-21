import { Container, Graphics, Rectangle } from "pixi.js";
import {
  fitElementBounds,
  fittedCardPadding,
  illustrationCardPadding,
  minCardHeight,
  minCardWidth,
} from "../engine/utils";
import type { CanvasCardInit, CardView } from "../types/canvas";
import type { CanvasElement } from "../types/elements";
import type { CardIndexItem } from "../types/events";
import { ElementArrow } from "./arrow";
import { hydrateElement, renderStaticIllustrationArrows } from "./helpers";
import { TextElement, type TextElementInit } from "./text";
import type { CanvasEngine } from "../engine";

type CardRenderOptions = {
  selected?: boolean;
  scale?: number;
  highlight?: "none" | "hover" | "solid";
  hiddenElementId?: string;
  revision?: number;
};

export abstract class CanvasCard {
  abstract kind?: "text";
  id: string;
  textSizing?: "fit" | "custom";
  x: number;
  y: number;
  width: number;
  height: number;
  elements: CanvasElement[];
  arrows?: ElementArrow[];
  backgroundColor?: number;
  locked: boolean;

  constructor(init: CanvasCardInit) {
    this.id = init.id;
    this.textSizing = init.textSizing;
    this.x = init.x;
    this.y = init.y;
    this.width = init.width;
    this.height = init.height;
    this.elements = init.elements.map((element) =>
      element.type === "text"
        ? new TextElement(element as TextElementInit)
        : hydrateElement(element),
    );
    this.arrows = init.arrows?.map(
      (arrow) =>
        new ElementArrow({
          ...arrow,
          routing: arrow.routing ?? "straight",
          endHead: arrow.endHead ?? "triangle",
        }),
    );
    this.backgroundColor = init.backgroundColor;
    this.locked = init.locked ?? false;
  }

  indexItem(): CardIndexItem {
    return {
      minX: this.x,
      minY: this.y,
      maxX: this.x + this.width,
      maxY: this.y + this.height,
      id: this.id,
    };
  }

  contentBounds() {
    const bounds = this.elements
      .map(fitElementBounds)
      .filter((value): value is Rectangle => Boolean(value));
    if (bounds.length === 0) return null;
    const minX = Math.min(...bounds.map(({ x }) => x));
    const minY = Math.min(...bounds.map(({ y }) => y));
    const maxX = Math.max(...bounds.map(({ x, width }) => x + width));
    const maxY = Math.max(...bounds.map(({ y, height }) => y + height));
    return new Rectangle(minX, minY, maxX - minX, maxY - minY);
  }

  fitToContent() {
    const bounds = this.contentBounds();
    if (!bounds) {
      this.width = minCardWidth;
      this.height = minCardHeight;
      return;
    }

    const padding = this.kind === "text" ? fittedCardPadding : illustrationCardPadding;
    const offset = { x: bounds.x - padding, y: bounds.y - padding };
    this.x += offset.x;
    this.y += offset.y;
    this.width = bounds.width + padding * 2;
    this.height = bounds.height + padding * 2;
    for (const element of this.elements) {
      if (element.type === "path") {
        for (const point of element.points) {
          point.x -= offset.x;
          point.y -= offset.y;
        }
      } else {
        element.x -= offset.x;
        element.y -= offset.y;
      }
    }
  }

  createView(engine: CanvasEngine, revision = 0): CardView {
    const view = this.buildView();
    this.render(engine, view, { revision });
    return view;
  }

  render(engine: CanvasEngine, view: CardView, options: CardRenderOptions = {}) {
    const state: ResolvedCardRenderOptions = {
      selected: false,
      scale: 1,
      highlight: "none",
      hiddenElementId: "",
      revision: 0,
      ...options,
    };
    this.renderFrame(view, state);
    this.renderContent(engine, view, state);
    this.renderSelection(view, state);
    this.renderHandles(view, state);
  }

  private buildView(): CardView {
    const view: CardView = {
      root: new Container(),
      background: new Graphics(),
      content: new Container(),
      contentMask: new Graphics(),
      border: new Graphics(),
      topLeftHandle: new Graphics(),
      bottomRightHandle: new Graphics(),
    };

    view.root.eventMode =
      view.topLeftHandle.eventMode =
      view.bottomRightHandle.eventMode =
        "static";
    view.root.cursor = "move";
    view.topLeftHandle.cursor = view.bottomRightHandle.cursor = "nwse-resize";
    view.content.mask = view.contentMask;
    view.root.addChild(
      view.background,
      view.content,
      view.contentMask,
      view.border,
      view.topLeftHandle,
      view.bottomRightHandle,
    );
    return view;
  }

  private renderFrame(view: CardView, { selected, scale }: ResolvedCardRenderOptions) {
    const chromeScale = 1 / Math.max(0.001, scale);
    view.root.position.set(this.x, this.y);
    view.root.hitArea = new Rectangle(
      0,
      0,
      this.width,
      Math.max(this.height, selected ? 58 * chromeScale : this.height),
    );
    view.background
      .clear()
      .roundRect(0, 0, this.width, this.height, 8)
      .fill({ color: this.backgroundColor ?? CARD_FILL })
      .stroke({ color: CARD_STROKE, width: 1.5 * chromeScale });
    view.contentMask
      .clear()
      .roundRect(
        fittedCardPadding,
        fittedCardPadding,
        Math.max(0, this.width - fittedCardPadding * 2),
        Math.max(0, this.height - fittedCardPadding * 2),
        7,
      )
      .fill({ color: 0xffffff });
  }

  private renderContent(
    engine: CanvasEngine,
    view: CardView,
    { hiddenElementId, scale, revision }: ResolvedCardRenderOptions,
  ) {
    const signature = `${revision}|${hiddenElementId}|${scale}|${JSON.stringify(this.elements)}|${JSON.stringify(this.arrows ?? [])}`;
    if (view.contentSignature === signature) return;
    for (const child of view.content.removeChildren()) child.destroy();
    renderStaticIllustrationArrows(view.content, this);
    for (const element of this.elements)
      if (element.id !== hiddenElementId) engine.drawElement(view.content, element);
    view.contentSignature = signature;
  }

  private renderSelection(
    view: CardView,
    { selected, scale, highlight }: ResolvedCardRenderOptions,
  ) {
    const chromeScale = 1 / Math.max(0.001, scale);
    view.border.clear();
    if (selected || highlight !== "none") {
      const solid = selected || highlight === "solid";
      view.border.roundRect(0, 0, this.width, this.height, 8).stroke({
        color: CARD_SELECTED,
        width: (solid ? 3 : 2) * chromeScale,
        alpha: solid ? 1 : 0.38,
      });
    }
  }

  private renderHandles(view: CardView, { selected, scale }: ResolvedCardRenderOptions) {
    const chromeScale = 1 / Math.max(0.001, scale);
    const handleSize = 14 * chromeScale;
    const hitSize = 38 * chromeScale;
    for (const handle of [view.topLeftHandle, view.bottomRightHandle]) {
      handle.clear();
      handle.hitArea = new Rectangle(-hitSize / 2, -hitSize / 2, hitSize, hitSize);
      handle.visible = selected && !this.locked;
    }
    if (selected && !this.locked) {
      const inset = 8 * (1 - Math.SQRT1_2);
      for (const handle of [view.topLeftHandle, view.bottomRightHandle]) {
        handle
          .circle(0, 0, handleSize / 2)
          .fill({ color: CARD_SELECTED })
          .stroke({ color: 0xffffff, width: 2 * chromeScale });
      }
      view.topLeftHandle.position.set(inset, inset);
      view.bottomRightHandle.position.set(this.width - inset, this.height - inset);
    }
  }
}

export class IllustrationCard extends CanvasCard {
  kind = undefined;
}
export class TextCard extends CanvasCard {
  kind = "text" as const;
}

export function createCard(init: CanvasCardInit) {
  return init.kind === "text" ? new TextCard(init) : new IllustrationCard(init);
}

export type BrowserMathJax = {
  startup?: { promise?: Promise<void>; typeset?: boolean };
  svg?: unknown;
  tex?: unknown;
  tex2svg?: (source: string, options?: { display?: boolean }) => Element;
};

type ResolvedCardRenderOptions = Required<CardRenderOptions>;
