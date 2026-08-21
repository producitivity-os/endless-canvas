import type { UploadedCanvasImage } from "../types";

export interface CanvasAssetAdapter {
  uploadImage(
    dataUrl: string,
    name: string,
  ): Promise<UploadedCanvasImage>;
}
