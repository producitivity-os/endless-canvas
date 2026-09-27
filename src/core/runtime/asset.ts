import type { UploadedCanvasImage } from "../types";

export interface CanvasAssetSelection {
  dataUrl: string;
  name: string;
  width: number;
  height: number;
}

export interface CanvasAssetAdapter {
  pickImage?(): Promise<CanvasAssetSelection | null>;
  pickVideo?(): Promise<CanvasVideoSelection | null>;
  uploadImage?(dataUrl: string, name: string): Promise<UploadedCanvasImage>;
}

export interface CanvasVideoSelection {
  src: string;
  previewSrc?: string;
  posterSrc?: string;
  mediaId?: string;
  name: string;
  width: number;
  height: number;
}
