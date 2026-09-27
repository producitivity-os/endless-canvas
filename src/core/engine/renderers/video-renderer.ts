import { Container, Graphics, Sprite, Texture } from "pixi.js";
import type { VideoObject } from "../../model";
import type { CanvasRenderContext, ElementRenderer } from "./renderer";
import { theme } from "../theme";

type VideoView = {
  objectId: string;
  source: string;
  video: HTMLVideoElement;
  texture: Texture;
  references: number;
};

export class VideoPlaybackRegistry {
  private readonly views = new Map<string, VideoView>();

  viewFor(object: VideoObject): VideoView | null {
    if (typeof document === "undefined") return null;
    const source = object.previewSrc || object.src;
    const key = this.key(object.id, source);
    const retained = this.views.get(key);
    if (retained) return retained;
    const video = document.createElement("video");
    video.src = source;
    video.preload = "metadata";
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    if (object.posterSrc) video.poster = object.posterSrc;
    const view = {
      objectId: object.id,
      source,
      video,
      texture: Texture.from(video),
      references: 0,
    };
    this.views.set(key, view);
    return view;
  }

  retain(object: VideoObject): VideoView | null {
    const view = this.viewFor(object);
    if (view) view.references += 1;
    return view;
  }

  async toggle(object: VideoObject): Promise<boolean> {
    const view = this.viewFor(object);
    if (!view) return false;
    if (view.video.paused) await view.video.play();
    else view.video.pause();
    return !view.video.paused;
  }

  release(id: string, source: string): void {
    const key = this.key(id, source);
    const view = this.views.get(key);
    if (!view) return;
    view.references = Math.max(0, view.references - 1);
    if (view.references > 0) return;
    this.destroyView(key, view);
  }

  dispose(id: string): void {
    for (const [key, view] of this.views) {
      if (view.objectId === id) this.destroyView(key, view);
    }
  }

  destroy(): void {
    for (const [key, view] of this.views) this.destroyView(key, view);
  }

  private destroyView(key: string, view: VideoView): void {
    view.video.pause();
    view.video.removeAttribute("src");
    view.video.load();
    view.texture.destroy(true);
    this.views.delete(key);
  }

  private key(id: string, source: string): string {
    return `${id}\u0000${source}`;
  }
}

export const videoPlaybackRegistry = new VideoPlaybackRegistry();

export class VideoRenderer implements ElementRenderer<VideoObject> {
  private readonly retainedSources = new Map<string, string>();

  render(target: Container, object: VideoObject, context: CanvasRenderContext): void {
    const root = new Container();
    const radius = Math.min(object.cornerRadius, object.width / 2, object.height / 2);
    root.addChild(
      new Graphics().roundRect(0, 0, object.width, object.height, radius).fill({ color: 0x111827 }),
    );
    const source = object.previewSrc || object.src;
    const retainedSource = this.retainedSources.get(object.id);
    if (retainedSource && retainedSource !== source) {
      videoPlaybackRegistry.release(object.id, retainedSource);
      this.retainedSources.delete(object.id);
    }
    const view = this.retainedSources.has(object.id)
      ? videoPlaybackRegistry.viewFor(object)
      : videoPlaybackRegistry.retain(object);
    if (view) this.retainedSources.set(object.id, source);
    if (view) {
      const sprite = new Sprite(view.texture);
      sprite.width = object.width;
      sprite.height = object.height;
      const mask = new Graphics()
        .roundRect(0, 0, object.width, object.height, radius)
        .fill({ color: 0xffffff });
      sprite.mask = mask;
      root.addChild(mask, sprite);
    }
    if (context.hovered && !context.selected) {
      const chromeScale = 1 / Math.max(context.scale, 0.001);
      root.addChild(
        new Graphics().roundRect(0, 0, object.width, object.height, radius).stroke({
          color: context.interactionColor,
          width: theme.interaction.frameWidth * chromeScale,
        }),
      );
    }
    root.position.set(object.x + object.width / 2, object.y + object.height / 2);
    root.pivot.set(object.width / 2, object.height / 2);
    root.rotation = object.rotation;
    root.alpha = object.opacity;
    target.addChild(root);
  }

  dispose(_target: Container, objectId: string): void {
    const source = this.retainedSources.get(objectId);
    if (source === undefined) return;
    this.retainedSources.delete(objectId);
    videoPlaybackRegistry.release(objectId, source);
  }

  destroy(): void {
    for (const [objectId, source] of this.retainedSources) {
      videoPlaybackRegistry.release(objectId, source);
    }
    this.retainedSources.clear();
  }
}
