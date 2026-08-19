import { resizeBoundsFromCorner } from "../engine/geometry";
import type { CanvasSpatialIndex } from "../engine/spatial";
import { boundsContainBounds, distanceToSegment, elementBounds, elementCenter, normalizeBounds, pathBounds, rotatePoint } from "../engine/utils";
import { ElementArrow } from "../model/arrow";
import type { CanvasCard } from "../model/card";
import { DragSession, type Draggable } from "../model/drag";
import { imageDataUrlSize } from "../model/image";
import { BaseTextElement, createTextElement, textPrimary, type TextElementInit, type TextVariant } from "../model/text";
import type { CanvasElement } from "../types/elements";
import type { DetailDrag, DetailTool, ResizeCorner } from "../types/events";
import type { Point } from "../types/geometry";
import type { CanvasAssetAdapter } from "./asset";
import { translateElement, type CanvasScene, type DetailRuntimeState } from "./scene";
import type { CanvasSelectionController } from "./selection";
import type { CanvasTextEditor } from "./texteditor";


export interface CanvasDetailControllerOptions {
  scene: CanvasScene;
  spatialIndex: CanvasSpatialIndex;

  activeCard():
    | CanvasCard
    | undefined;

  getCard(
    id: string,
  ): CanvasCard | undefined;

  selection: CanvasSelectionController;

  // selectedElementArrowIds: Set<string>;

  assets: CanvasAssetAdapter;

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

  textEditor: CanvasTextEditor;

  textIndexAtPoint(
    element: BaseTextElement,
    point: Point,
  ): number;
}




export class CanvasDetailController {

  private readonly options: CanvasDetailControllerOptions;
  constructor(
    options: CanvasDetailControllerOptions,
  ) {
    this.options = options
  }

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

    this.options.selection.elements.clear();

    this.options.selection.elements.add(
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
        await this.options.assets.uploadImage(
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
          .selection.elements.size ===
        0 &&
        this.options
          .selection.elements
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
            .selection.elements
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
            .selection.isElementArrowSelected(arrow.id)
          &&
          !this.options
            .selection.elements
            .has(
              arrow.fromElementId,
            ) &&
          !this.options
            .selection.elements
            .has(
              arrow.toElementId,
            ),
      );

    this.options.selection.clearElements();

    this.options
      .selection.clearElementArrows();

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
            .selection.isElementSelected(element.id)
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

    this.options.selection.clearElements();

    for (
      const element of pasted
    ) {
      this.options.selection.selectElement(element.id)
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

    this.options.selection.clearElements();

    for (
      const element of card.elements
    ) {
      this.options.selection.selectElement(element.id)
    }

    this.options.refresh();
  }

  private selectOnly(
    elementId: string,
  ): void {
    this.options.selection.clearElements();

    this.options.selection.selectElement(elementId)
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

  private updatePan(
    point: Point,
    drag: Extract<
      DetailDrag,
      { type: "pan-detail" }
    >,
  ): void {
    this.state.origin = {
      x:
        drag.origin.x +
        point.x -
        drag.start.x,

      y:
        drag.origin.y +
        point.y -
        drag.start.y,
    };
  }
  private beginShapeDraw(
    point: Point,
    kind: "rect" | "ellipse",
  ): void {
    this.options.selection.clearElements();
    this.options.selection.clearElementArrows();

    this.state.drag = {
      type: "draw-element",
      kind,
      origin: point,
      current: point,
    };

    this.options.scene.setCursor(
      "crosshair",
    );

    this.options.refresh();
  }
  private beginLineDraw(
    point: Point,
  ): void {
    const card =
      this.options.activeCard();

    if (!card) {
      return;
    }

    this.options.beginUndoGroup();

    const element: CanvasElement = {
      id: crypto.randomUUID(),
      type: "path",

      points: [
        { ...point },
        { ...point },
      ],

      color: 0x18181b,
      width: 2,
    };

    card.elements.push(element);

    this.options.selection
      .selectOnlyElement(
        element.id,
      );

    this.options.markElementsDirty(
      card.id,
    );

    this.state.drag = {
      type: "draw-line",
      id: element.id,
    };

    this.options.refresh();
  }
  private updateLineDraw(
    point: Point,
    drag: Extract<
      DetailDrag,
      { type: "draw-line" }
    >,
  ): void {
    const card =
      this.options.activeCard();

    if (!card) {
      return;
    }

    const element =
      card.elements.find(
        (element) =>
          element.id === drag.id,
      );

    if (
      !element ||
      element.type !== "path"
    ) {
      return;
    }

    element.points[1] = {
      x: point.x,
      y: point.y,
    };

    this.options.markElementsDirty(
      card.id,
    );
  }
  private finishLineDraw(
    drag: Extract<
      DetailDrag,
      { type: "draw-line" }
    >,
  ): void {
    const card =
      this.options.activeCard();

    if (!card) {
      return;
    }

    const index =
      card.elements.findIndex(
        (element) =>
          element.id === drag.id,
      );

    if (index === -1) {
      return;
    }

    const element =
      card.elements[index];

    if (
      element.type !== "path" ||
      element.points.length < 2
    ) {
      card.elements.splice(index, 1);

      this.options.selection
        .clearElements();

      this.options.markElementsDirty(
        card.id,
      );

      return;
    }

    const start =
      element.points[0];

    const end =
      element.points[
      element.points.length - 1
      ];

    const length =
      Math.hypot(
        end.x - start.x,
        end.y - start.y,
      );

    // Don't keep accidental clicks as lines.
    if (length < 2) {
      card.elements.splice(index, 1);

      this.options.selection
        .clearElements();

      this.options.markElementsDirty(
        card.id,
      );

      this.options.refresh();

      return;
    }

    this.options.markElementsDirty(
      card.id,
    );

    this.options.commit();
    this.options.scheduleSave();
  }
  private beginTextDraw(
    point: Point,
  ): void {
    this.options.selection.clearElements();
    this.options.selection.clearElementArrows();

    this.state.drag = {
      type: "draw-element",
      kind: "text",
      origin: point,
      current: point,
    };

    this.options.scene.setCursor(
      "crosshair",
    );

    this.options.refresh();
  }
  private finishElementDraw(
    drag: Extract<
      DetailDrag,
      { type: "draw-element" }
    >,
  ): void {
    const bounds =
      normalizeBounds(
        drag.origin.x,
        drag.origin.y,
        drag.current.x,
        drag.current.y,
      );

    if (
      bounds.width < 4 ||
      bounds.height < 4
    ) {
      return;
    }

    switch (drag.kind) {
      case "text":
        this.addText(bounds);
        break;

      case "rect":
        this.addRectangle(bounds);
        break;

      case "ellipse":
        this.addEllipse(bounds);
        break;
    }
  }
  private beginPathDraw(
    point: Point,
  ): void {
    const card =
      this.options.activeCard();

    if (!card) {
      return;
    }

    this.options.beginUndoGroup();

    const element: CanvasElement = {
      id: crypto.randomUUID(),
      type: "path",
      points: [
        {
          x: point.x,
          y: point.y,
        },
      ],
      color: 0x18181b,
      width: 2,
    };

    card.elements.push(element);

    this.options.markElementsDirty(
      card.id,
    );

    this.options.selection
      .selectOnlyElement(
        element.id,
      );

    this.state.drag = {
      type: "draw-path",
      id: element.id,
    };

    this.options.refresh();
  }

  private updatePathDraw(
    point: Point,
    drag: Extract<
      DetailDrag,
      { type: "draw-path" }
    >,
  ): void {
    const card =
      this.options.activeCard();

    if (!card) {
      return;
    }

    const element =
      card.elements.find(
        (element) =>
          element.id === drag.id,
      );

    if (
      !element ||
      element.type !== "path"
    ) {
      return;
    }

    const last =
      element.points[
      element.points.length - 1
      ];

    if (
      last &&
      Math.hypot(
        point.x - last.x,
        point.y - last.y,
      ) < 2
    ) {
      return;
    }

    element.points.push({
      x: point.x,
      y: point.y,
    });

    this.options.markElementsDirty(
      card.id,
    );
  }

  private finishPathDraw(
    _drag: Extract<
      DetailDrag,
      { type: "draw-path" }
    >,
  ): void {
    this.options.commit();
    this.options.scheduleSave();
  }

  pointerDown(
    point: Point,
    event: PointerEvent,
  ): void {
    if (event.button !== 0) {
      return;
    }

    const state = this.state;

    if (state.tool === "hand") {
      state.drag = {
        type: "pan-detail",
        start: point,
        origin: {
          ...state.origin,
        },
      };

      this.options.scene.setCursor(
        "grabbing",
      );

      return;
    }

    if (state.tool === "text") {
      this.beginTextDraw(point);
      return;
    }

    if (
      state.tool === "rect" ||
      state.tool === "ellipse"
    ) {
      this.beginShapeDraw(
        point,
        state.tool,
      );

      return;
    }

    if (state.tool === "pencil") {
      this.beginPathDraw(point);
      return;
    }

    if (state.tool === "line") {
      this.beginLineDraw(point);
      return;
    }

    if (state.tool === "arrow") {
      this.beginArrowInteraction(
        point,
      );

      return;
    }

    this.beginSelectionInteraction(
      point,
      event,
    );
  }
  private updateElementResize(
    point: Point,
    drag: Extract<
      DetailDrag,
      { type: "resize-element" }
    >,
    preserveAspectRatio = false,
  ): void {
    const card =
      this.options.activeCard();

    if (!card) {
      return;
    }

    const element =
      card.elements.find(
        (element) =>
          element.id === drag.id,
      );

    if (
      !element ||
      element.type === "path"
    ) {
      return;
    }

    const bounds =
      resizeBoundsFromCorner(
        drag.corner,
        drag.origin,
        point,
        8,
        8,
        preserveAspectRatio,
      );

    element.x = bounds.x;
    element.y = bounds.y;

    element.width =
      bounds.width;

    element.height =
      bounds.height;

    this.options.markElementsDirty(
      card.id,
    );
  }
  private updateHover(
    point: Point,
  ): void {
    const resizeHit =
      this.hitSelectedElementResizeHandle(
        point,
      );

    if (resizeHit) {
      this.state.hoveredElementId =
        resizeHit.element.id;

      this.state.hoveredArrowId = "";

      this.options.scene.setCursor(
        "nwse-resize",
      );

      this.options.refresh();
      return;
    }

    const rotateHit =
      this.hitSelectedElementRotateHandle(
        point,
      );

    if (rotateHit) {
      this.state.hoveredElementId =
        rotateHit.id;

      this.state.hoveredArrowId = "";

      this.options.scene.setCursor(
        "grab",
      );

      this.options.refresh();
      return;
    }

    const arrow =
      this.hitElementArrowAt(
        point,
      );

    const element =
      this.hitElementAt(
        point,
      );

    const nextElementId =
      element?.id ?? "";

    const nextArrowId =
      arrow?.id ?? "";

    const changed =
      nextElementId !==
      this.state.hoveredElementId ||
      nextArrowId !==
      this.state.hoveredArrowId;

    this.state.hoveredElementId =
      nextElementId;

    this.state.hoveredArrowId =
      nextArrowId;

    this.options.scene.setCursor(
      element || arrow
        ? "pointer"
        : "",
    );

    if (changed) {
      this.options.refresh();
    }
  }
  private beginSelectionInteraction(
    point: Point,
    event: PointerEvent,
  ): void {
    const card =
      this.options.activeCard();

    if (!card) {
      return;
    }

    const resizeHit =
      this.hitSelectedElementResizeHandle(
        point,
      );

    if (resizeHit) {
      this.options.beginUndoGroup();

      this.state.drag = {
        type: "resize-element",
        id: resizeHit.element.id,
        corner: resizeHit.corner,
        start: point,

        origin: {
          x: resizeHit.element.x,
          y: resizeHit.element.y,
          width: resizeHit.element.width,
          height: resizeHit.element.height,
        },
      };

      this.options.scene.setCursor(
        "nwse-resize",
      );

      return;
    }

    const rotateHit =
      this.hitSelectedElementRotateHandle(
        point,
      );

    if (rotateHit) {
      const bounds =
        elementBounds(
          rotateHit,
        );

      const center = {
        x:
          bounds.x +
          bounds.width / 2,

        y:
          bounds.y +
          bounds.height / 2,
      };

      this.options.beginUndoGroup();

      this.state.drag = {
        type: "rotate-element",
        id: rotateHit.id,
        center,

        startAngle:
          Math.atan2(
            point.y - center.y,
            point.x - center.x,
          ),

        originRotation:
          rotateHit.rotation ?? 0,
      };

      this.options.scene.setCursor(
        "grabbing",
      );

      return;
    }

    const arrow =
      this.hitElementArrowAt(
        point,
      );

    if (arrow) {
      if (event.shiftKey) {
        this.options.selection
          .toggleElementArrow(
            arrow.id,
          );
      } else {
        this.options.selection
          .selectOnlyElementArrow(
            arrow.id,
          );
      }

      this.options.refresh();
      return;
    }

    const element =
      this.hitElementAt(point);

    if (element) {
      if (event.shiftKey) {
        this.options.selection
          .toggleElement(element.id);

        this.options.refresh();
        return;
      }

      if (
        !this.options.selection
          .isElementSelected(
            element.id,
          )
      ) {
        this.options.selection
          .selectOnlyElement(
            element.id,
          );
      }

      this.beginElementDrag(point);
      return;
    }

    if (!event.shiftKey) {
      this.options.selection
        .clearElements();

      this.options.selection
        .clearElementArrows();
    }

    this.state.drag = {
      type: "marquee",
      origin: point,
      current: point,
    };

    this.options.refresh();
  }
  private beginArrowInteraction(
    point: Point,
  ): void {
    const card = this.options.activeCard();

    if (!card) {
      return;
    }

    const element =
      this.hitElementAt(point);

    if (!element) {
      this.options.selection.clearElements();
      this.options.selection.clearElementArrows();
      this.options.refresh();
      return;
    }

    this.options.selection.selectOnlyElement(
      element.id,
    );

    this.state.drag = {
      type: "draw-arrow",
      fromElementId: element.id,
      current: point,
    };

    this.options.scene.setCursor(
      "crosshair",
    );

    this.options.refresh();
  }

  pointerMove(
    point: Point,
    event: PointerEvent,
  ): void {
    const drag =
      this.state.drag;

    if (!drag) {
      this.updateHover(point);
      return;
    }

    switch (drag.type) {
      case "pan-detail":
        this.updatePan(
          point,
          drag,
        );
        break;

      case "move-elements":
        drag.session.move(point);
        break;

      case "resize-element":
        this.updateElementResize(
          point,
          drag,
          event.shiftKey,
        );
        break;

      case "rotate-element":
        this.updateElementRotation(
          point,
          drag,
        );
        break;

      case "draw-element":
        drag.current = point;
        break;

      case "draw-path":
        this.updatePathDraw(
          point,
          drag,
        );
        break;

      case "draw-line":
        this.updateLineDraw(
          point,
          drag,
        );
        break;

      case "draw-arrow":
        drag.current = point;
        break;

      case "select-text":
        this.updateTextSelection(
          point,
          drag,
        );
        break;

      case "crop-image":
        this.updateImageCrop(
          point,
          drag,
        );
        break;

      case "marquee":
        drag.current = point;

        this.updateMarqueeSelection(
          drag,
        );
        break;

      case "bend-element-arrow":
        this.updateArrowBend(
          point,
          drag,
        );
        break;
    }

    this.options.refresh();
  }

  pointerUp(
    point: Point,
    _event: PointerEvent,
  ): void {
    const drag =
      this.state.drag;

    if (!drag) {
      return;
    }

    switch (drag.type) {
      case "pan-detail":
        break;

      case "move-elements":
      case "resize-element":
      case "rotate-element":
      case "crop-image":
      case "bend-element-arrow":
        this.options.commit();
        this.options.scheduleSave();
        break;

      case "draw-element":
        this.finishElementDraw(
          drag,
        );
        break;

      case "draw-path":
        this.finishPathDraw(
          drag,
        );
        break;

      case "draw-line":
        this.finishLineDraw(
          drag,
        );
        break;

      case "draw-arrow":
        this.finishArrowDraw(
          point,
          drag,
        );
        break;

      case "marquee":
        drag.current = point;

        this.updateMarqueeSelection(
          drag,
        );
        break;

      case "select-text":
        break;
    }

    this.state.drag = null;

    this.options.scene.setCursor(
      this.state.tool === "hand"
        ? "grab"
        : "",
    );

    this.options.refresh();
  }
  private updateElementRotation(
    point: Point,
    drag: Extract<
      DetailDrag,
      { type: "rotate-element" }
    >,
  ): void {
    const card =
      this.options.activeCard();

    if (!card) {
      return;
    }

    const element =
      card.elements.find(
        (element) =>
          element.id === drag.id,
      );

    if (!element) {
      return;
    }

    const angle =
      Math.atan2(
        point.y - drag.center.y,
        point.x - drag.center.x,
      );

    const delta =
      angle - drag.startAngle;

    element.rotation =
      drag.originRotation +
      delta;

    this.options.markElementsDirty(
      card.id,
    );
  }
  private updateTextSelection(
    point: Point,
    drag: Extract<
      DetailDrag,
      { type: "select-text" }
    >,
  ): void {
    const card =
      this.options.activeCard();

    if (!card) {
      return;
    }

    const element =
      card.elements.find(
        (element) =>
          element.id === drag.elementId,
      );

    if (
      !element ||
      element.type !== "text"
    ) {
      return;
    }

    const index =
      this.options.textIndexAtPoint(
        element,
        point,
      );

    this.options.textEditor.setSelection(
      this.options.textEditor.current
        ?.selection.anchor ?? index,
      index,
    );

    this.options.refresh();
  }
  private updateImageCrop(
    point: Point,
    drag: Extract<
      DetailDrag,
      { type: "crop-image" }
    >,
  ): void {
    const card =
      this.options.activeCard();

    if (!card) {
      return;
    }

    const cropEdit =
      this.state.cropEdit;

    if (!cropEdit) {
      return;
    }

    const element =
      card.elements.find(
        (element) =>
          element.id ===
          cropEdit.elementId,
      );

    if (
      !element ||
      element.type !== "image"
    ) {
      return;
    }

    const bounds =
      resizeBoundsFromCorner(
        drag.corner,
        drag.origin,
        point,
        1,
        1,
        false,
      );

    const x =
      Math.max(
        0,
        Math.min(
          element.width,
          bounds.x,
        ),
      );

    const y =
      Math.max(
        0,
        Math.min(
          element.height,
          bounds.y,
        ),
      );

    const right =
      Math.max(
        x,
        Math.min(
          element.width,
          bounds.x +
          bounds.width,
        ),
      );

    const bottom =
      Math.max(
        y,
        Math.min(
          element.height,
          bounds.y +
          bounds.height,
        ),
      );

    element.crop = {
      x,
      y,
      width:
        right - x,
      height:
        bottom - y,
    };

    this.options.markElementsDirty(
      card.id,
    );
  }

  private updateMarqueeSelection(
    drag: Extract<
      DetailDrag,
      { type: "marquee" }
    >,
  ): void {
    const card =
      this.options.activeCard();

    if (!card) {
      return;
    }

    const bounds =
      normalizeBounds(
        drag.origin.x,
        drag.origin.y,
        drag.current.x,
        drag.current.y,
      );

    const selected =
      new Set<string>();

    for (const element of card.elements) {
      const elementBox =
        elementBounds(element);

      if (
        boundsContainBounds(
          bounds,
          elementBox,
        )
      ) {
        selected.add(
          element.id,
        );
      }
    }

    this.options.selection.selectElements(
      selected,
    );

    this.options.selection
      .clearElementArrows();

    this.options.refresh();
  }
  // private hitElementAt(
  //   point: Point,
  // ): CanvasElement | null
  //
  // private hitElementArrowAt(
  //   point: Point,
  // ): ElementArrow | null
  //
  // private hitSelectedElementResizeHandle(
  //   point: Point,
  // ): {
  //   element: Exclude<
  //     CanvasElement,
  //     { type: "path" }
  //   >;
  //   corner: ResizeCorner;
  // } | null
  //
  // private hitSelectedElementRotateHandle(
  //   point: Point,
  // ): CanvasElement | null
  //
  // private beginElementDrag(
  //   point: Point,
  // ): void

  private updateArrowBend(
    point: Point,
    drag: Extract<
      DetailDrag,
      { type: "bend-element-arrow" }
    >,
  ): void {
    const card =
      this.options.activeCard();

    if (!card) {
      return;
    }

    const arrow =
      (card.arrows ?? []).find(
        (arrow) =>
          arrow.id === drag.id,
      );

    if (!arrow) {
      return;
    }

    const from =
      card.elements.find(
        (element) =>
          element.id ===
          arrow.fromElementId,
      );

    const to =
      card.elements.find(
        (element) =>
          element.id ===
          arrow.toElementId,
      );

    if (!from || !to) {
      return;
    }

    const fromCenter =
      elementCenter(from);

    const toCenter =
      elementCenter(to);

    const dx =
      toCenter.x -
      fromCenter.x;

    const dy =
      toCenter.y -
      fromCenter.y;

    const length =
      Math.hypot(dx, dy);

    if (length < 0.001) {
      return;
    }

    const normalX =
      -dy / length;

    const normalY =
      dx / length;

    const pointerDeltaX =
      point.x -
      drag.start.x;

    const pointerDeltaY =
      point.y -
      drag.start.y;

    const bendDelta =
      pointerDeltaX *
      normalX +
      pointerDeltaY *
      normalY;

    arrow.bend =
      drag.originBend +
      bendDelta;

    this.options.markElementsDirty(
      card.id,
    );
  }
  private hitSelectedElementResizeHandle(
    point: Point,
  ): {
    element: Exclude<
      CanvasElement,
      { type: "path" }
    >;
    corner: ResizeCorner;
  } | null {
    const card =
      this.options.activeCard();

    if (!card) {
      return null;
    }

    const scale =
      Math.max(
        0.001,
        this.state.scale,
      );

    const tolerance =
      10 / scale;

    for (
      const id of
      this.options.selection.elements
    ) {
      const element =
        card.elements.find(
          (element) =>
            element.id === id,
        );

      if (
        !element ||
        element.type === "path"
      ) {
        continue;
      }

      const bounds =
        elementBounds(element);

      const corners: Array<{
        corner: ResizeCorner;
        point: Point;
      }> = [
          {
            corner: "topLeft",
            point: {
              x: bounds.x,
              y: bounds.y,
            },
          },
          {
            corner: "topRight",
            point: {
              x:
                bounds.x +
                bounds.width,
              y: bounds.y,
            },
          },
          {
            corner: "bottomRight",
            point: {
              x:
                bounds.x +
                bounds.width,
              y:
                bounds.y +
                bounds.height,
            },
          },
          {
            corner: "bottomLeft",
            point: {
              x: bounds.x,
              y:
                bounds.y +
                bounds.height,
            },
          },
        ];

      for (const handle of corners) {
        if (
          Math.hypot(
            point.x -
            handle.point.x,
            point.y -
            handle.point.y,
          ) <= tolerance
        ) {
          return {
            element,
            corner:
              handle.corner,
          };
        }
      }
    }

    return null;
  }
  private hitSelectedElementRotateHandle(
    point: Point,
  ): CanvasElement | null {
    const card =
      this.options.activeCard();

    if (!card) {
      return null;
    }

    const scale =
      Math.max(
        0.001,
        this.state.scale,
      );

    const tolerance =
      10 / scale;

    const handleOffset =
      28 / scale;

    for (
      const id of
      this.options.selection.elements
    ) {
      const element =
        card.elements.find(
          (element) =>
            element.id === id,
        );

      if (!element) {
        continue;
      }

      const bounds =
        elementBounds(element);

      const center =
        elementCenter(element);

      const handle = {
        x:
          bounds.x +
          bounds.width / 2,
        y:
          bounds.y -
          handleOffset,
      };

      const rotation =
        element.rotation ?? 0;

      const rotatedHandle =
        rotatePoint(
          handle,
          center,
          rotation,
        );

      if (
        Math.hypot(
          point.x -
          rotatedHandle.x,
          point.y -
          rotatedHandle.y,
        ) <= tolerance
      ) {
        return element;
      }
    }

    return null;
  }
  private hitElementArrowAt(
    point: Point,
  ): ElementArrow | null {
    const card =
      this.options.activeCard();

    if (!card) {
      return null;
    }

    const tolerance =
      8 /
      Math.max(
        0.001,
        this.state.scale,
      );

    const arrows =
      card.arrows ?? [];

    for (
      let i =
        arrows.length - 1;
      i >= 0;
      i--
    ) {
      const arrow =
        arrows[i];

      const from =
        card.elements.find(
          (element) =>
            element.id ===
            arrow.fromElementId,
        );

      const to =
        card.elements.find(
          (element) =>
            element.id ===
            arrow.toElementId,
        );

      if (!from || !to) {
        continue;
      }

      const start =
        elementCenter(from);

      const end =
        elementCenter(to);

      if (
        distanceToSegment(
          point,
          start,
          end,
        ) <= tolerance
      ) {
        return arrow;
      }
    }

    return null;
  }

  private hitElementAt(
    point: Point,
  ): CanvasElement | null {
    const card =
      this.options.activeCard();

    if (!card) {
      return null;
    }

    const hits =
      this.options.spatialIndex.searchElements(
        card.id,
        {
          x: point.x,
          y: point.y,
          width: 1,
          height: 1,
        },
      );

    if (hits.length === 0) {
      return null;
    }

    return hits[hits.length - 1] ?? null;
  }
  private finishArrowDraw(
    point: Point,
    drag: Extract<
      DetailDrag,
      { type: "draw-arrow" }
    >,
  ): void {
    const card =
      this.options.activeCard();

    if (!card) {
      return;
    }

    const from =
      card.elements.find(
        (element) =>
          element.id ===
          drag.fromElementId,
      );

    const to =
      this.hitElementAt(point);

    if (
      !from ||
      !to ||
      from.id === to.id
    ) {
      return;
    }

    const arrow = new ElementArrow({
      id: crypto.randomUUID(),

      fromElementId: from.id,
      toElementId: to.id,

      fromAnchor: {
        x: 0.5,
        y: 0.5,
      },

      toAnchor: {
        x: 0.5,
        y: 0.5,
      },

      routing: "straight",

      startHead: "none",
      endHead: "triangle",

      bend: 0,
    });

    card.arrows ??= [];

    card.arrows.push(
      arrow,
    );

    this.options.selection
      .selectOnlyElementArrow(
        arrow.id,
      );

    this.options.markElementsDirty(
      card.id,
    );

    this.options.commit();
    this.options.scheduleSave();
  }
  private beginElementDrag(
    point: Point,
  ): void {
    const card =
      this.options.activeCard();

    if (!card) {
      return;
    }

    const targets: Draggable[] = [];

    for (
      const id of
      this.options.selection.elements
    ) {
      const element =
        card.elements.find(
          (element) =>
            element.id === id,
        );

      if (!element) {
        continue;
      }

      if (element.type === "path") {
        targets.push({
          id,

          position: () => {
            const bounds =
              pathBounds(
                element.points,
              );

            return {
              x: bounds.x,
              y: bounds.y,
            };
          },

          moveTo: (position) => {
            const bounds =
              pathBounds(
                element.points,
              );

            translateElement(
              element,
              position.x - bounds.x,
              position.y - bounds.y,
            );

            this.options.markElementsDirty(
              card.id,
            );
          },
        });

        continue;
      }

      targets.push({
        id,

        position: () => ({
          x: element.x,
          y: element.y,
        }),

        moveTo: (position) => {
          element.x =
            position.x;

          element.y =
            position.y;

          this.options.markElementsDirty(
            card.id,
          );
        },
      });
    }

    if (targets.length === 0) {
      return;
    }

    this.options.beginUndoGroup();

    this.state.drag = {
      type: "move-elements",
      session: new DragSession(
        point,
        targets,
      ),
    };

    this.options.scene.setCursor(
      "move",
    );
  }
}
