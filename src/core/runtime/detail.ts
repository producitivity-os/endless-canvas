import { createTextElement, TextElementInit, textPrimary, TextVariant } from "../text";
import { CanvasCard, CanvasElement, DetailTool, Point } from "../types";
import { CanvasScene, DetailRuntimeState, translateElement } from "./scene";
import { imageDataUrlSize } from "../image";
import { uploadCanvasImage } from "@/api/canvas";


export interface CanvasDetailControllerOptions {
  scene: CanvasScene;

  activeCard():
    | CanvasCard
    | undefined;

  getCard(
    id: string,
  ): CanvasCard | undefined;

  selectedElements: Set<string>;

  selectedElementArrowIds: Set<string>;

  beginUndoGroup(): void;
  commit(): void;

  markElementsDirty(
    cardId: string,
  ): void;

  refresh(): void;

  scheduleSave(): void;

  commitTextEdit(): void;

  removeEmptyTextElements(
    card: CanvasCard | undefined,
  ): void;

  captureInteractionSnapshot(): unknown;

  toCardPoint(
    point: Point,
  ): Point;
}


export class CanvasDetailController {
  readonly state: DetailRuntimeState = {
    drag: null,

    hoveredElementId: "",
    hoveredArrowId: "",

    cropEdit: null,

    tool: "select",
    shapeTool: "rect",
    textVariant: "body",

    scale: 1,

    origin: {
      x: 0,
      y: 0,
    },
  };

  private elementClipboard:
    CanvasElement[] = [];

  constructor(
    private readonly options:
      CanvasDetailControllerOptions,
  ) { }

  setTool(
    tool: DetailTool,
  ): void {
    this.options.commitTextEdit();

    this.options.removeEmptyTextElements(
      this.options.activeCard(),
    );

    this.state.tool = tool;

    this.options.scene.setCursor(
      tool === "pencil"
        ? "crosshair"
        : tool === "hand"
          ? "grab"
          : "",
    );

    this.options.refresh();
  }

  cycleTextVariant(): void {
    const variants: TextVariant[] = [
      "body",
      "heading",
      "caption",
      "latex",
    ];

    const current =
      variants.indexOf(
        this.state.textVariant,
      );

    this.state.textVariant =
      variants[
      (current + 1) %
      variants.length
      ];

    this.setTool("text");
  }

  setShapeTool(
    shape:
      | "rect"
      | "ellipse",
  ): void {
    this.state.shapeTool = shape;
    this.setTool("rect");
  }

  addText(
    bounds?: {
      x: number;
      y: number;
      width: number;
      height: number;
    },
  ): CanvasElement | null {
    const card =
      this.options.activeCard();

    if (!card) {
      return null;
    }

    this.options.beginUndoGroup();

    const variant =
      this.state.textVariant;

    const element =
      createTextElement({
        id: crypto.randomUUID(),

        x: bounds?.x ?? 32,
        y: bounds?.y ?? 32,

        width:
          bounds?.width ??
          (variant === "latex"
            ? 260
            : 220),

        height:
          Math.ceil(
            (
              variant ===
                "heading"
                ? 28
                : variant ===
                  "caption"
                  ? 14
                  : 18
            ) * 1.35,
          ) + 8,

        text: "",

        fontSize:
          variant === "heading"
            ? 28
            : variant ===
              "caption"
              ? 14
              : 18,

        color: textPrimary,

        fontFamily: "inter",

        variant,

        singleLine: true,

        textAlign: "left",
        verticalAlign: "center",
      });

    card.elements.push(element);

    this.options.markElementsDirty(
      card.id,
    );

    this.options.selectedElements.clear();

    this.options.selectedElements.add(
      element.id,
    );

    this.options.refresh();
    this.options.scheduleSave();

    return element;
  }

  addRectangle(
    bounds?: {
      x: number;
      y: number;
      width: number;
      height: number;
    },
  ): CanvasElement | null {
    const card =
      this.options.activeCard();

    if (!card) {
      return null;
    }

    this.options.beginUndoGroup();

    const element: CanvasElement = {
      id: crypto.randomUUID(),

      type: "rect",

      x: bounds?.x ?? 42,
      y: bounds?.y ?? 42,

      width:
        bounds?.width ?? 120,

      height:
        bounds?.height ?? 82,

      fill: 0x18181b,
      stroke: 0x18181b,
    };

    card.elements.push(element);

    this.options.markElementsDirty(
      card.id,
    );

    this.selectOnly(
      element.id,
    );

    this.options.refresh();
    this.options.scheduleSave();

    return element;
  }

  addEllipse(
    bounds?: {
      x: number;
      y: number;
      width: number;
      height: number;
    },
  ): CanvasElement | null {
    const card =
      this.options.activeCard();

    if (!card) {
      return null;
    }

    this.options.beginUndoGroup();

    const element: CanvasElement = {
      id: crypto.randomUUID(),

      type: "ellipse",

      x: bounds?.x ?? 56,
      y: bounds?.y ?? 56,

      width:
        bounds?.width ?? 112,

      height:
        bounds?.height ?? 88,

      fill: 0x18181b,
      stroke: 0x18181b,
    };

    card.elements.push(element);

    this.options.markElementsDirty(
      card.id,
    );

    this.selectOnly(
      element.id,
    );

    this.options.refresh();
    this.options.scheduleSave();

    return element;
  }

  async addImage(
    dataUrl: string,
    position?: Point,
    name = "pasted-image.png",
  ): Promise<void> {
    const card =
      this.options.activeCard();

    if (!card) {
      return;
    }

    this.options.beginUndoGroup();

    const size =
      await imageDataUrlSize(
        dataUrl,
      );

    const center =
      this.options.toCardPoint({
        x:
          this.options.scene.app
            .screen.width / 2,

        y:
          this.options.scene.app
            .screen.height / 2,
      });

    const topLeft =
      position ?? {
        x:
          center.x -
          size.width / 2,

        y:
          center.y -
          size.height / 2,
      };

    const element: CanvasElement = {
      id: crypto.randomUUID(),

      type: "image",

      x: topLeft.x,
      y: topLeft.y,

      width: size.width,
      height: size.height,

      src: "",
      previewSrc: dataUrl,

      name,

      uploadStatus:
        "uploading",

      lockAspectRatio: true,
    };

    card.elements.push(element);

    this.options.markElementsDirty(
      card.id,
    );

    this.selectOnly(
      element.id,
    );

    this.options.refresh();
    this.options.commit();

    try {
      const upload =
        await uploadCanvasImage(
          dataUrl,
          name,
        );

      const currentCard =
        this.options.getCard(
          card.id,
        );

      const currentElement =
        currentCard?.elements.find(
          (candidate) =>
            candidate.id ===
            element.id,
        );

      if (
        currentElement?.type !==
        "image"
      ) {
        return;
      }

      currentElement.src =
        upload.url;

      currentElement.name =
        upload.name;

      delete currentElement.previewSrc;

      currentElement.uploadStatus =
        "ready";

      this.options.refresh();
      this.options.scheduleSave();
    } catch (error) {
      const currentCard =
        this.options.getCard(
          card.id,
        );

      const currentElement =
        currentCard?.elements.find(
          (candidate) =>
            candidate.id ===
            element.id,
        );

      if (
        currentElement?.type ===
        "image"
      ) {
        currentElement.uploadStatus =
          "failed";

        this.options.refresh();
      }

      console.warn(
        "Failed to upload image.",
        error,
      );
    }
  }

  deleteSelectedElements(): void {
    const card =
      this.options.activeCard();

    if (
      !card ||
      (
        this.options
          .selectedElements.size ===
        0 &&
        this.options
          .selectedElementArrowIds
          .size === 0
      )
    ) {
      return;
    }

    this.options.beginUndoGroup();

    card.elements =
      card.elements.filter(
        (element) =>
          !this.options
            .selectedElements
            .has(element.id),
      );

    this.options.markElementsDirty(
      card.id,
    );

    card.arrows =
      (
        card.arrows ?? []
      ).filter(
        (arrow) =>
          !this.options
            .selectedElementArrowIds
            .has(arrow.id) &&
          !this.options
            .selectedElements
            .has(
              arrow.fromElementId,
            ) &&
          !this.options
            .selectedElements
            .has(
              arrow.toElementId,
            ),
      );

    this.options.selectedElements.clear();

    this.options
      .selectedElementArrowIds
      .clear();

    this.options.refresh();
    this.options.scheduleSave();
  }

  copySelectedElements(): void {
    const card =
      this.options.activeCard();

    if (!card) {
      return;
    }

    this.elementClipboard =
      card.elements
        .filter((element) =>
          this.options
            .selectedElements
            .has(element.id),
        )
        .map((element) =>
          this.cloneElement(
            element,
          ),
        );
  }

  pasteElements(): void {
    const card =
      this.options.activeCard();

    if (
      !card ||
      this.elementClipboard
        .length === 0
    ) {
      return;
    }

    this.options.beginUndoGroup();

    const pasted =
      this.elementClipboard.map(
        (element) => {
          const next =
            this.cloneElement(
              element,
            );

          next.id =
            crypto.randomUUID();

          translateElement(
            next,
            24,
            24,
          );

          return next;
        },
      );

    card.elements.push(
      ...pasted,
    );

    this.options.markElementsDirty(
      card.id,
    );

    this.options.selectedElements.clear();

    for (
      const element of pasted
    ) {
      this.options.selectedElements.add(
        element.id,
      );
    }

    this.elementClipboard =
      pasted.map((element) =>
        this.cloneElement(
          element,
        ),
      );

    this.options.refresh();
    this.options.scheduleSave();
  }

  selectAllElements(): void {
    const card =
      this.options.activeCard();

    if (!card) {
      return;
    }

    this.options.selectedElements.clear();

    for (
      const element of card.elements
    ) {
      this.options.selectedElements.add(
        element.id,
      );
    }

    this.options.refresh();
  }

  private selectOnly(
    elementId: string,
  ): void {
    this.options.selectedElements.clear();

    this.options.selectedElements.add(
      elementId,
    );
  }

  private cloneElement(
    element: CanvasElement,
  ): CanvasElement {
    const clone =
      structuredClone(
        element,
      );

    if (
      clone.type ===
      "text"
    ) {
      return createTextElement(
        clone as unknown as TextElementInit,
      );
    }

    return clone;
  }


}
