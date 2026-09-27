import { CanvasObject, type CanvasObjectInit } from "../object.ts";

export type VideoObjectInit = CanvasObjectInit & {
  src: string;
  previewSrc?: string;
  posterSrc?: string;
  mediaId?: string;
  name?: string;
  sourceWidth?: number;
  sourceHeight?: number;
  cornerRadius?: number;
};

export class VideoObject extends CanvasObject {
  readonly type = "video" as const;
  src: string;
  previewSrc?: string;
  posterSrc?: string;
  mediaId?: string;
  name?: string;
  sourceWidth?: number;
  sourceHeight?: number;
  cornerRadius: number;

  constructor(init: VideoObjectInit) {
    super(init);
    this.src = init.src;
    this.previewSrc = init.previewSrc;
    this.posterSrc = init.posterSrc;
    this.mediaId = init.mediaId;
    this.name = init.name;
    this.sourceWidth = init.sourceWidth;
    this.sourceHeight = init.sourceHeight;
    this.cornerRadius = init.cornerRadius ?? 8;
  }
}
