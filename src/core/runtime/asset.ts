export interface UploadedCanvasImage {
  url: string;
  name: string;
}

export interface CanvasAssetAdapter {
  uploadImage(
    dataUrl: string,
    name: string,
  ): Promise<UploadedCanvasImage>;
}
