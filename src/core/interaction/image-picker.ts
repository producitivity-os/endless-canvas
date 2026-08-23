import { fileToDataUrl, imageDataUrlSize } from "../model/image";

export interface PickedCanvasImage {
  dataUrl: string;
  name: string;
  width: number;
  height: number;
}

export class CanvasImagePicker {
  private readonly input: HTMLInputElement;
  private resolve: ((image: PickedCanvasImage | null) => void) | null = null;

  constructor(host: HTMLElement) {
    this.input = document.createElement("input");
    this.input.type = "file";
    this.input.accept = "image/*";
    this.input.tabIndex = -1;
    this.input.setAttribute("aria-hidden", "true");
    this.input.style.display = "none";
    this.input.addEventListener("change", this.onChange);
    this.input.addEventListener("cancel", this.onCancel);
    host.appendChild(this.input);
  }

  pick(): Promise<PickedCanvasImage | null> {
    this.resolve?.(null);
    this.input.value = "";

    return new Promise((resolve) => {
      this.resolve = resolve;
      this.input.click();
    });
  }

  destroy(): void {
    this.resolve?.(null);
    this.resolve = null;
    this.input.removeEventListener("change", this.onChange);
    this.input.removeEventListener("cancel", this.onCancel);
    this.input.remove();
  }

  private onChange = (): void => {
    const file = this.input.files?.[0];
    if (!file) {
      this.finish(null);
      return;
    }

    void this.read(file);
  };

  private onCancel = (): void => {
    this.finish(null);
  };

  private async read(file: File): Promise<void> {
    try {
      const dataUrl = await fileToDataUrl(file);
      const size = await imageDataUrlSize(dataUrl);
      this.finish({ dataUrl, name: file.name, ...size });
    } catch {
      this.finish(null);
    }
  }

  private finish(image: PickedCanvasImage | null): void {
    const resolve = this.resolve;
    this.resolve = null;
    resolve?.(image);
  }
}
