export interface ClipboardRgbaImage {
  rgba: Uint8Array;
  width: number;
  height: number;
}

export class ClipboardImageCodec {
  async decodeSource(source: string): Promise<ClipboardRgbaImage> {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Clipboard image could not be loaded (${response.status}).`);
    }
    const bitmap = await createImageBitmap(await response.blob());
    try {
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Clipboard image conversion is unavailable.");
      context.drawImage(bitmap, 0, 0);
      const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height);
      return {
        rgba: new Uint8Array(pixels.data),
        width: bitmap.width,
        height: bitmap.height,
      };
    } finally {
      bitmap.close();
    }
  }

  encodePngDataUrl(image: ClipboardRgbaImage): string {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Clipboard image conversion is unavailable.");
    const pixels = new ImageData(new Uint8ClampedArray(image.rgba), image.width, image.height);
    context.putImageData(pixels, 0, 0);
    return canvas.toDataURL("image/png");
  }

  async fingerprint(image: ClipboardRgbaImage): Promise<string> {
    const prefix = `image:${image.width}x${image.height}`;
    if (!globalThis.crypto?.subtle) return `${prefix}:${image.rgba.byteLength}`;
    const bytes = new Uint8Array(image.rgba);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes.buffer);
    const hash = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    return `${prefix}:${hash}`;
  }
}
