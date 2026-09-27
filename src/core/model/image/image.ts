import { CanvasObject, type CanvasObjectInit } from "../object.ts";

export type ImageObjectInit = CanvasObjectInit &
  Omit<
    ImageObject,
    keyof Element | "type" | "layerId" | "capabilities" | "moveTo" | "translate" | "bounds"
  >;

export interface CanvasImageCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class ImageObject extends CanvasObject {
  readonly type = "image" as const;
  src: string;
  name?: string;
  crop?: CanvasImageCrop;
  sourceWidth?: number;
  sourceHeight?: number;
  previewSrc?: string;
  uploadStatus?: "uploading" | "ready" | "failed";
  lockAspectRatio?: boolean;
  cornerRadius?: number;
  constructor(init: ImageObjectInit) {
    super(init);
    this.src = init.src;
    this.name = init.name;
    this.crop = init.crop;
    this.sourceWidth = init.sourceWidth;
    this.sourceHeight = init.sourceHeight;
    this.previewSrc = init.previewSrc;
    this.uploadStatus = init.uploadStatus;
    this.lockAspectRatio = init.lockAspectRatio;
    this.cornerRadius = init.cornerRadius;
  }
}

export type ImageRendererOptions = { onChange?: () => void; onError?: (message: string) => void };

// export interface ImageElement extends CanvasObject {
//   type: "image";
//   src: string;
//   name?: string;
//   crop?: { x: number; y: number; width: number; height: number };
//   previewSrc?: string;
//   uploadStatus?: "uploading" | "ready" | "failed";
//   lockAspectRatio?: boolean;
//   cornerRadius?: number;
// }
//
