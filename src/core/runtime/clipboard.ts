import { canvasObjectFactory, type ArrowObject, type CanvasObject } from "../model/index.ts";
import type { CanvasCardObject } from "../model/card/card.ts";
import { canvasVisualBounds } from "../engine/visual-bounds.ts";

export type SystemClipboardPayload =
  | { kind: "empty" }
  | { kind: "text"; text: string }
  | { kind: "elements"; elements: CanvasObject[] }
  | { kind: "image"; dataUrl: string; mimeType: string; fingerprint: string };

export interface CanvasSystemClipboard {
  write(elements: readonly CanvasObject[], token: string): Promise<string>;
  read(): Promise<SystemClipboardPayload>;
}

interface CanvasClipboardEnvelope {
  type: "productivity-os/canvas-elements";
  version: 1;
  elements: readonly CanvasObject[];
}

export const serializeCanvasElements = (elements: readonly CanvasObject[]): string =>
  JSON.stringify({
    type: "productivity-os/canvas-elements",
    version: 1,
    elements,
  } satisfies CanvasClipboardEnvelope);

export const canvasClipboardText = (elements: readonly CanvasObject[], _token: string): string =>
  elements.length === 1 && elements[0].type === "text"
    ? (elements[0] as unknown as { text: string }).text
    : serializeCanvasElements(elements);

export const systemClipboardPayloadFromText = (text: string): SystemClipboardPayload => {
  try {
    const envelope = JSON.parse(text) as Partial<CanvasClipboardEnvelope>;
    if (
      envelope.type === "productivity-os/canvas-elements"
      && envelope.version === 1
      && Array.isArray(envelope.elements)
      && envelope.elements.length > 0
    ) {
      return {
        kind: "elements",
        elements: envelope.elements.map((element) => canvasObjectFactory.hydrate(element)),
      };
    }
  } catch {
    // Ordinary clipboard text is not a canvas payload.
  }
  return text ? { kind: "text", text } : { kind: "empty" };
};

export class SystemCanvasClipboard implements CanvasSystemClipboard {
  async write(elements: readonly CanvasObject[], token: string): Promise<string> {
    const plainText = canvasClipboardText(elements, token);
    if (typeof navigator === "undefined" || !navigator.clipboard) return plainText;
    const image = elements.length === 1 && elements[0].type === "image"
      ? elements[0] as unknown as { src: string }
      : null;
    if (image && typeof ClipboardItem !== "undefined") {
      try {
        const blob = await fetch(image.src).then((response) => response.blob());
        await navigator.clipboard.write([new ClipboardItem({ [blob.type || "image/png"]: blob })]);
        return this.imageFingerprint(blob);
      } catch {
        // Fall through to a text fingerprint while retaining the deep in-app copy.
      }
    }
    await navigator.clipboard.writeText(plainText);
    return plainText;
  }

  async read(): Promise<SystemClipboardPayload> {
    if (typeof navigator === "undefined" || !navigator.clipboard) return { kind: "empty" };
    if (navigator.clipboard.read) {
      try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find((type) => type.startsWith("image/"));
          if (!imageType) continue;
          const blob = await item.getType(imageType);
          return {
            kind: "image",
            dataUrl: await this.dataUrl(blob),
            mimeType: imageType,
            fingerprint: await this.imageFingerprint(blob),
          };
        }
      } catch {
        // Some WebViews expose readText but not unrestricted clipboard item reads.
      }
    }
    try {
      const text = await navigator.clipboard.readText();
      return systemClipboardPayloadFromText(text);
    } catch {
      return { kind: "empty" };
    }
  }

  private dataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error("Clipboard image could not be read."));
      reader.readAsDataURL(blob);
    });
  }

  private async imageFingerprint(blob: Blob): Promise<string> {
    const bytes = await blob.arrayBuffer();
    if (globalThis.crypto?.subtle) {
      const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
      const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
      return `image:${blob.type}:${blob.size}:${hex}`;
    }
    return `image:${blob.type}:${blob.size}`;
  }
}

export class CanvasClipboard {
  private elements: CanvasObject[] = [];
  private token = "";
  private systemFingerprint = "";

  get hasElements(): boolean {
    return this.elements.length > 0;
  }

  clear(): void {
    this.elements = [];
    this.token = "";
    this.systemFingerprint = "";
  }

  copyElements(elements: Iterable<CanvasObject>): string {
    this.elements = Array.from(elements, (element) => this.cloneElement(element));
    this.token = crypto.randomUUID();
    return this.token;
  }

  setSystemFingerprint(value: string): void {
    this.systemFingerprint = value;
  }

  matchesSystemPayload(payload: SystemClipboardPayload): boolean {
    if (!this.hasElements) return false;
    if (payload.kind === "text") return payload.text === this.systemFingerprint;
    if (payload.kind === "image") return payload.fingerprint === this.systemFingerprint;
    return false;
  }

  pasteElements(anchor?: { x: number; y: number }): CanvasObject[] {
    if (!this.hasElements) return [];
    const clones = this.elements.map((element) => this.cloneElement(element));
    const idMap = new Map<string, string>();
    this.walk(clones, (object) => idMap.set(object.id, crypto.randomUUID()));
    this.walk(clones, (object) => {
      object.id = idMap.get(object.id) ?? crypto.randomUUID();
      if (object.type !== "arrow") return;
      const arrow = object as ArrowObject;
      for (const endpoint of [arrow.start, arrow.end]) {
        if (!endpoint.binding) continue;
        if (idMap.has(endpoint.binding.objectId)) endpoint.binding.objectId = idMap.get(endpoint.binding.objectId)!;
        else endpoint.binding = undefined;
      }
    });
    const bounds = canvasVisualBounds.forObjects(clones);
    const dx = anchor && bounds ? anchor.x - (bounds.x + bounds.width / 2) : 24;
    const dy = anchor && bounds ? anchor.y - (bounds.y + bounds.height / 2) : 24;
    for (const clone of clones) clone.translate(dx, dy);
    this.elements = clones.map((element) => this.cloneElement(element));
    return clones;
  }

  private cloneElement(element: CanvasObject): CanvasObject {
    return canvasObjectFactory.hydrate(structuredClone(element));
  }

  private walk(objects: readonly CanvasObject[], visit: (object: CanvasObject) => void): void {
    for (const object of objects) {
      visit(object);
      if (object.type === "card") this.walk((object as CanvasCardObject).elements, visit);
    }
  }

}
