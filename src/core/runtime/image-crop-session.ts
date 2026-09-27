import { boxGeometry } from "../engine/box-geometry.ts";
import type { CanvasImageCrop, ImageObject } from "../model";
import type { CanvasImageCropPreview, CanvasPoint } from "../types";
import { selectionHandles } from "../engine/renderers/selection-handles.ts";

type CropHandle = "topLeft" | "topRight" | "bottomRight" | "bottomLeft";

interface CropDrag {
  type: "move" | "resize";
  handle?: CropHandle;
  pointerStart: CanvasPoint;
  frameStart: CanvasImageCropPreview["frame"];
}

export class CanvasImageCropSession {
  readonly imageId: string;
  private readonly image: ImageObject;
  private readonly originalCrop: CanvasImageCrop;
  private readonly originalBounds: { x: number; y: number; width: number; height: number };
  private readonly source: CanvasImageCropPreview["source"];
  private frame: CanvasImageCropPreview["frame"];
  private drag: CropDrag | null = null;

  constructor(image: ImageObject) {
    this.image = image;
    this.imageId = image.id;
    this.originalCrop = { ...(image.crop ?? { x: 0, y: 0, width: 1, height: 1 }) };
    this.originalBounds = image.bounds();

    const sourceWidth = Math.max(1, image.sourceWidth ?? image.width / this.originalCrop.width);
    const sourceHeight = Math.max(1, image.sourceHeight ?? image.height / this.originalCrop.height);
    const displayScale = image.width / Math.max(sourceWidth * this.originalCrop.width, 0.001);
    const fullWidth = sourceWidth * displayScale;
    const fullHeight = sourceHeight * displayScale;
    const frameHeight = fullHeight * this.originalCrop.height;
    const frameY = (image.height - frameHeight) / 2;

    this.source = {
      x: -this.originalCrop.x * fullWidth,
      y: frameY - this.originalCrop.y * fullHeight,
      width: fullWidth,
      height: fullHeight,
    };
    this.frame = { x: 0, y: frameY, width: image.width, height: frameHeight };
  }

  preview(): CanvasImageCropPreview {
    return {
      imageId: this.imageId,
      source: { ...this.source },
      frame: { ...this.frame },
    };
  }

  beginDrag(point: CanvasPoint, scale: number): boolean {
    const local = this.worldToLocal(point);
    const handle = this.hitHandle(local, scale);
    if (handle) {
      this.drag = {
        type: "resize",
        handle,
        pointerStart: local,
        frameStart: { ...this.frame },
      };
      return true;
    }
    if (this.contains(this.frame, local)) {
      this.drag = {
        type: "move",
        pointerStart: local,
        frameStart: { ...this.frame },
      };
      return true;
    }
    return false;
  }

  update(point: CanvasPoint, scale: number): boolean {
    if (!this.drag) {
      return false;
    }
    const local = this.worldToLocal(point);
    const dx = local.x - this.drag.pointerStart.x;
    const dy = local.y - this.drag.pointerStart.y;
    const before = { ...this.frame };

    if (this.drag.type === "move") {
      this.frame.x = this.clamp(
        this.drag.frameStart.x + dx,
        this.source.x,
        this.source.x + this.source.width - this.frame.width,
      );
      this.frame.y = this.clamp(
        this.drag.frameStart.y + dy,
        this.source.y,
        this.source.y + this.source.height - this.frame.height,
      );
    } else if (this.drag.handle) {
      this.resize(this.drag.handle, dx, dy, 24 / Math.max(scale, 0.001));
    }

    return (
      before.x !== this.frame.x ||
      before.y !== this.frame.y ||
      before.width !== this.frame.width ||
      before.height !== this.frame.height
    );
  }

  endDrag(): void {
    this.drag = null;
  }

  cursorAt(point: CanvasPoint, scale: number): string {
    const local = this.worldToLocal(point);
    const handle = this.drag?.handle ?? this.hitHandle(local, scale);
    if (handle) return selectionHandles.cursor(handle, this.image.rotation);
    if (this.drag?.type === "move" || this.contains(this.frame, local)) return "move";
    return this.contains(this.source, local) ? "crosshair" : "default";
  }

  containsSource(point: CanvasPoint): boolean {
    return this.contains(this.source, this.worldToLocal(point));
  }

  commit(): boolean {
    const crop = {
      x: (this.frame.x - this.source.x) / this.source.width,
      y: (this.frame.y - this.source.y) / this.source.height,
      width: this.frame.width / this.source.width,
      height: this.frame.height / this.source.height,
    };
    const changed =
      !this.nearlyEqual(crop.x, this.originalCrop.x) ||
      !this.nearlyEqual(crop.y, this.originalCrop.y) ||
      !this.nearlyEqual(crop.width, this.originalCrop.width) ||
      !this.nearlyEqual(crop.height, this.originalCrop.height);
    if (!changed) {
      return false;
    }

    const originalCenter = boxGeometry.center(this.originalBounds);
    const frameCenter = boxGeometry.rotatePoint(
      {
        x: this.originalBounds.x + this.frame.x + this.frame.width / 2,
        y: this.originalBounds.y + this.frame.y + this.frame.height / 2,
      },
      originalCenter,
      this.image.rotation,
    );
    this.image.x = frameCenter.x - this.frame.width / 2;
    this.image.y = frameCenter.y - this.frame.height / 2;
    this.image.width = this.frame.width;
    this.image.height = this.frame.height;
    this.image.crop = crop;
    return true;
  }

  cancel(): void {
    this.image.x = this.originalBounds.x;
    this.image.y = this.originalBounds.y;
    this.image.width = this.originalBounds.width;
    this.image.height = this.originalBounds.height;
    this.image.crop = { ...this.originalCrop };
    this.drag = null;
  }

  private resize(handle: CropHandle, dx: number, dy: number, minimum: number): void {
    const start = this.drag?.frameStart ?? this.frame;
    let left = start.x;
    let top = start.y;
    let right = start.x + start.width;
    let bottom = start.y + start.height;

    if (handle === "topLeft" || handle === "bottomLeft") {
      left = this.clamp(start.x + dx, this.source.x, right - minimum);
    } else {
      right = this.clamp(
        start.x + start.width + dx,
        left + minimum,
        this.source.x + this.source.width,
      );
    }
    if (handle === "topLeft" || handle === "topRight") {
      top = this.clamp(start.y + dy, this.source.y, bottom - minimum);
    } else {
      bottom = this.clamp(
        start.y + start.height + dy,
        top + minimum,
        this.source.y + this.source.height,
      );
    }
    this.frame = { x: left, y: top, width: right - left, height: bottom - top };
  }

  private hitHandle(point: CanvasPoint, scale: number): CropHandle | null {
    const radius = 14 / Math.max(scale, 0.001);
    const handles: Array<[CropHandle, CanvasPoint]> = [
      ["topLeft", { x: this.frame.x, y: this.frame.y }],
      ["topRight", { x: this.frame.x + this.frame.width, y: this.frame.y }],
      ["bottomRight", { x: this.frame.x + this.frame.width, y: this.frame.y + this.frame.height }],
      ["bottomLeft", { x: this.frame.x, y: this.frame.y + this.frame.height }],
    ];
    return (
      handles.find(
        ([, handlePoint]) => Math.hypot(point.x - handlePoint.x, point.y - handlePoint.y) <= radius,
      )?.[0] ?? null
    );
  }

  private worldToLocal(point: CanvasPoint): CanvasPoint {
    const center = boxGeometry.center(this.originalBounds);
    const unrotated = boxGeometry.rotatePoint(point, center, -this.image.rotation);
    return { x: unrotated.x - this.originalBounds.x, y: unrotated.y - this.originalBounds.y };
  }

  private contains(
    rect: { x: number; y: number; width: number; height: number },
    point: CanvasPoint,
  ): boolean {
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    );
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.max(minimum, Math.min(maximum, value));
  }

  private nearlyEqual(a: number, b: number): boolean {
    return Math.abs(a - b) < 0.000001;
  }
}
