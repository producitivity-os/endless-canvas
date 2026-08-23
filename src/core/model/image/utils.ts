import { Container, Graphics, Texture } from "pixi.js";
import { normalizeImageUrl } from "../../store/serialization";
import type { CanvasCardObject } from "../card";
import type { ImageObject, ImageRendererOptions } from "./image";

export function imageDataUrlSize(dataUrl: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      });
    image.onerror = () => reject(new Error("Could not read pasted image dimensions."));
    image.src = dataUrl;
  });
}

const textures = new Map<string, Texture>();
const loading = new Set<string>();
const failedAt = new Map<string, number>();
const retryTimers = new Map<string, number>();
const reportedErrors = new Set<string>();
let options: ImageRendererOptions = {};

export function configureImageRenderer(next: ImageRendererOptions) {
  options = next;
}

export function imageTextureFor(src: string) {
  const url = normalizeImageUrl(src);
  if (!url) return null;
  const cached = textures.get(url);
  if (cached) return cached;
  const lastFailure = failedAt.get(url) ?? 0;
  if (!loading.has(url) && performance.now() - lastFailure > 2400) {
    loading.add(url);
    failedAt.delete(url);
    options.onChange?.();
    const image = new Image();
    if (!url.startsWith("data:") && !url.startsWith("blob:")) image.crossOrigin = "anonymous";
    image.onload = () => {
      loading.delete(url);
      failedAt.delete(url);
      reportedErrors.delete(url);
      const timer = retryTimers.get(url);
      if (timer) window.clearTimeout(timer);
      retryTimers.delete(url);
      textures.set(url, Texture.from(image));
      options.onChange?.();
    };
    image.onerror = () => {
      loading.delete(url);
      failedAt.set(url, performance.now());
      if (!reportedErrors.has(url)) {
        reportedErrors.add(url);
        options.onError?.(`Image could not be loaded: ${url}`);
      }
      options.onChange?.();
      if (!retryTimers.has(url))
        retryTimers.set(
          url,
          window.setTimeout(() => {
            retryTimers.delete(url);
            imageTextureFor(url);
          }, 2600),
        );
    };
    image.src = url;
  }
  return null;
}

export function imageLoadFailed(src: string) {
  const url = normalizeImageUrl(src);
  return Boolean(url && failedAt.has(url) && !loading.has(url));
}
export function imageIsLoading(src: string) {
  const url = normalizeImageUrl(src);
  return Boolean(url && loading.has(url));
}

export function preloadCanvasImages(cards: CanvasCardObject[]) {
  for (const card of cards)
    for (const element of card.elements)
      if (element.type === "image") {
        const image = element as ImageObject;
        const source = image.previewSrc || image.src;
        if (source) imageTextureFor(source);
      }
}

export function drawBrokenImageIcon(width: number, height: number) {
  const root = new Container();
  const size = Math.max(28, Math.min(56, Math.min(width, height) * 0.24));
  root.position.set(width / 2, height / 2);
  const left = new Graphics()
    .roundRect(-size * 0.56, -size * 0.15, size * 0.66, size * 0.3, size * 0.15)
    .stroke({ color: 0x6b7280, width: 3 });
  left.rotation = -0.55;
  const right = new Graphics()
    .roundRect(-size * 0.1, -size * 0.15, size * 0.66, size * 0.3, size * 0.15)
    .stroke({ color: 0x6b7280, width: 3 });
  right.rotation = -0.55;
  const breakLine = new Graphics()
    .moveTo(-size * 0.06, -size * 0.44)
    .lineTo(-size * 0.18, -size * 0.2)
    .moveTo(size * 0.08, size * 0.2)
    .lineTo(size * 0.2, size * 0.44)
    .stroke({ color: 0x8b5cf6, width: 3, cap: "round" });
  root.addChild(left, right, breakLine);
  return root;
}

export function fileToDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
