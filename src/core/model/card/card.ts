import type { CardIndexItem } from "../../types";
import { CanvasObject, type CanvasObjectInit, type CanvasObjectType } from "../object.ts";
import type { ArrowObject } from "../arrow";
import type { CardTemplateValue } from "./template.ts";

export interface CanvasCardInit extends CanvasObjectInit {
  id: string;
  kind?: CanvasCardKind | "text";
  markdown?: string;
  textSizing?: "fit" | "custom";
  x: number;
  y: number;
  width: number;
  height: number;
  elements: CanvasObject[];
  arrows?: ArrowObject[];
  backgroundColor?: number;
  locked?: boolean;
  templateId?: string;
  templateValues?: Record<string, CardTemplateValue>;
  revisionKind?: RevisionCardKind;
  front?: string;
  back?: string;
  cloze?: string;
  pluginId?: string;
  pluginVersion?: number;
  pluginData?: Record<string, unknown>;
}

export type CanvasCardKind = "canvas" | "markdown" | "template" | "revision" | "plugin";
export type RevisionCardKind = "basic" | "cloze";

export abstract class CanvasCardObject extends CanvasObject {
  abstract kind: CanvasCardKind;
  id: string;
  textSizing?: "fit" | "custom";
  x: number;
  y: number;
  width: number;
  height: number;
  elements: CanvasObject[];
  arrows?: ArrowObject[];
  backgroundColor?: number;
  locked: boolean;
  markdown: string;

  constructor(init: CanvasCardInit) {
    super(init);
    this.id = init.id;
    this.textSizing = init.textSizing;
    this.x = init.x;
    this.y = init.y;
    this.width = init.width;
    this.height = init.height;
    this.elements = init.elements;
    // this.elements = init.elements.map((element) =>
    //   element.type === "text" ? new TextObject(element as TextObjectInit) : hydrateElement(element),
    // );
    // this.arrows = init.arrows?.map(
    //   (arrow) =>
    //     new CanvasCardObject({
    //       ...arrow,
    //       routing: arrow.routing ?? "straight",
    //       endHead: arrow.endHead ?? "triangle",
    //     }),
    // );
    this.backgroundColor = init.backgroundColor;
    this.locked = init.locked ?? false;
    this.markdown = init.markdown ?? "";
    this.type = "card";
  }
  type: CanvasObjectType;

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
    // const bounds = this.elements
    //   .map(fitElementBounds)
    //   .filter((value): value is Rectangle => Boolean(value));
    // if (bounds.length === 0) return null;
    // const minX = Math.min(...bounds.map(({ x }) => x));
    // const minY = Math.min(...bounds.map(({ y }) => y));
    // const maxX = Math.max(...bounds.map(({ x, width }) => x + width));
    // const maxY = Math.max(...bounds.map(({ y, height }) => y + height));
    // return new Rectangle(minX, minY, maxX - minX, maxY - minY);
  }

  fitToContent() {
    // const bounds = this.contentBounds();
    // if (!bounds) {
    //   this.width = minCardWidth;
    //   this.height = minCardHeight;
    //   return;
    // }
    //
    // const padding = this.kind === "text" ? fittedCardPadding : illustrationCardPadding;
    // const offset = { x: bounds.x - padding, y: bounds.y - padding };
    // this.x += offset.x;
    // this.y += offset.y;
    // this.width = bounds.width + padding * 2;
    // this.height = bounds.height + padding * 2;
    // for (const element of this.elements) {
    //   if (element.type === "path") {
    //     for (const point of element.points) {
    //       point.x -= offset.x;
    //       point.y -= offset.y;
    //     }
    //   } else {
    //     element.x -= offset.x;
    //     element.y -= offset.y;
    //   }
    // }
  }
}

export class IllustrationCard extends CanvasCardObject {
  kind = "canvas" as const;
}
export class TextCard extends CanvasCardObject {
  kind = "canvas" as const;
}
export class MarkdownCard extends CanvasCardObject {
  kind = "markdown" as const;
}
export class TemplateCard extends CanvasCardObject {
  kind = "template" as const;
  templateId: string;
  templateValues: Record<string, CardTemplateValue>;

  constructor(init: CanvasCardInit) {
    super({
      ...init,
      capabilities: { ...init.capabilities, resizable: false },
      elements: [],
    });
    this.templateId = init.templateId ?? "";
    this.templateValues = structuredClone(init.templateValues ?? {});
  }
}

export class RevisionCard extends CanvasCardObject {
  kind = "revision" as const;
  revisionKind: RevisionCardKind;
  front: string;
  back: string;
  cloze: string;

  constructor(init: CanvasCardInit) {
    super({ ...init, elements: [] });
    this.revisionKind = init.revisionKind ?? "basic";
    this.front = init.front ?? "Question";
    this.back = init.back ?? "Answer";
    this.cloze = init.cloze ?? "A {{c1::cloze}} hides part of a fact.";
  }
}

export class PluginCard extends CanvasCardObject {
  kind = "plugin" as const;
  pluginId: string;
  pluginVersion: number;
  pluginData: Record<string, unknown>;

  constructor(init: CanvasCardInit) {
    super({ ...init, elements: [] });
    this.pluginId = init.pluginId ?? "";
    this.pluginVersion = init.pluginVersion ?? 1;
    this.pluginData = structuredClone(init.pluginData ?? {});
  }
}

export function createCard(init: CanvasCardInit) {
  if (init.kind === "markdown") return new MarkdownCard(init);
  if (init.kind === "template") return new TemplateCard(init);
  if (init.kind === "revision") return new RevisionCard(init);
  if (init.kind === "plugin") return new PluginCard(init);
  if (init.kind === "text") return new TextCard(init);
  return new IllustrationCard(init);
}

export type BrowserMathJax = {
  startup?: { promise?: Promise<void>; typeset?: boolean };
  svg?: unknown;
  tex?: unknown;
  tex2svg?: (source: string, options?: { display?: boolean }) => Element;
};
