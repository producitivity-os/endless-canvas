import { Container, Graphics, Texture } from "pixi.js";
import type { CanvasCardObject } from "../card";
import type { ImageObject, ImageRendererOptions } from "./image";
import {
  imageRequestNeedsCors,
  imageSourceCandidates,
  normalizeImageSource,
} from "./image-url.ts";

export {
  imageRequestNeedsCors,
  imageSourceCandidates,
  normalizeImageSource,
} from "./image-url.ts";

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
const subscriptions = new Set<ImageRendererOptions>();
let changeQueued = false;
let textureRevision = 0;

export function imageTextureRevision() {
  return textureRevision;
}

export function configureImageRenderer(next: ImageRendererOptions) {
  options = next;
}

export function subscribeImageRenderer(next: ImageRendererOptions) {
  subscriptions.add(next);
  return () => subscriptions.delete(next);
}

function notifyImageChange() {
  textureRevision += 1;
  if (changeQueued) return;
  changeQueued = true;
  queueMicrotask(() => {
    changeQueued = false;
    options.onChange?.();
    for (const subscriber of subscriptions) subscriber.onChange?.();
  });
}

function notifyImageError(message: string) {
  options.onError?.(message);
  for (const subscriber of subscriptions) subscriber.onError?.(message);
}

function imageTextureForSingle(src: string, reportFailure: boolean) {
  const url = normalizeImageSource(src);
  if (!url) return null;
  const cached = textures.get(url);
  if (cached) return cached;
  if (typeof Image === "undefined") return null;
  const lastFailure = failedAt.get(url) ?? 0;
  if (!loading.has(url) && performance.now() - lastFailure > 2400) {
    loading.add(url);
    failedAt.delete(url);
    notifyImageChange();
    const image = new Image();
    if (imageRequestNeedsCors(url)) image.crossOrigin = "anonymous";
    image.onload = () => {
      void (async () => {
        try {
          await image.decode?.();
          const texture = Texture.from(image);
          loading.delete(url);
          failedAt.delete(url);
          reportedErrors.delete(url);
          const timer = retryTimers.get(url);
          if (timer) window.clearTimeout(timer);
          retryTimers.delete(url);
          textures.set(url, texture);
          notifyImageChange();
        } catch {
          failImageLoad(url, reportFailure);
        }
      })();
    };
    image.onerror = () => failImageLoad(url, reportFailure);
    image.src = url;
  }
  return null;
}

function failImageLoad(url: string, reportFailure: boolean) {
  loading.delete(url);
  failedAt.set(url, performance.now());
  if (reportFailure && !reportedErrors.has(url)) {
    reportedErrors.add(url);
    notifyImageError(`Image could not be loaded: ${url}`);
  }
  notifyImageChange();
  if (reportFailure && !retryTimers.has(url)) {
    retryTimers.set(
      url,
      window.setTimeout(() => {
        retryTimers.delete(url);
        imageTextureForSingle(url, true);
      }, 2600),
    );
  }
}

export function imageTextureFor(src: string, fallbackSrc?: string) {
  const [primary, fallback] = imageSourceCandidates(src, fallbackSrc);
  if (!primary) return null;
  const primaryTexture = imageTextureForSingle(primary, !fallback);
  if (primaryTexture || !failedAt.has(normalizeImageSource(primary)) || !fallback) {
    return primaryTexture;
  }
  return imageTextureForSingle(fallback, true);
}

export function imageLoadFailed(src: string, fallbackSrc?: string) {
  const [primary, fallback] = imageSourceCandidates(src, fallbackSrc).map(normalizeImageSource);
  if (!primary || textures.has(primary) || loading.has(primary) || !failedAt.has(primary)) {
    return false;
  }
  if (!fallback) return true;
  return !textures.has(fallback) && !loading.has(fallback) && failedAt.has(fallback);
}

export function imageIsLoading(src: string, fallbackSrc?: string) {
  const [primary, fallback] = imageSourceCandidates(src, fallbackSrc).map(normalizeImageSource);
  if (!primary) return false;
  return loading.has(primary) || Boolean(fallback && failedAt.has(primary) && loading.has(fallback));
}

export function preloadCanvasImages(cards: CanvasCardObject[]) {
  for (const card of cards)
    for (const element of card.elements)
      if (element.type === "image") {
        const image = element as ImageObject;
        const [source, fallback] = imageSourceCandidates(image.previewSrc, image.src);
        if (source) imageTextureFor(source, fallback);
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
