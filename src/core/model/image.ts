import type { BaseElement } from "../types/types";

export async function imageDataUrlSize(
  dataUrl: string,
): Promise<{
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };

    image.onerror = () => {
      reject(
        new Error(
          "Failed to load image from data URL.",
        ),
      );
    };

    image.src = dataUrl;
  });
}

export class ImageElement extends Element {
  readonly type = "image" as const;
  src: string; name?: string; crop?: { x: number; y: number; width: number; height: number }; previewSrc?: string;
  uploadStatus?: "uploading" | "ready" | "failed"; lockAspectRatio?: boolean; opacity?: number; cornerRadius?: number;
  constructor(init: BaseElement & Omit<ImageElement, keyof Element | "type" | "moveTo" | "translate" | "bounds">) {
    super(init); this.src = init.src; this.name = init.name; this.crop = init.crop; this.previewSrc = init.previewSrc; this.uploadStatus = init.uploadStatus; this.lockAspectRatio = init.lockAspectRatio; this.opacity = init.opacity; this.cornerRadius = init.cornerRadius;
  }
}
