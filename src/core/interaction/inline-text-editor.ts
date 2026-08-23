import type { CanvasPoint } from "../types";
import { CanvasTextMetrics, type CanvasTextEditorStyle, type CanvasTextSize } from "./text-metrics";
import { CanvasTextCaretMapper } from "./text-caret-mapper";

export interface CanvasTextEditRequest {
  point: CanvasPoint;
  initialValue: string;
  initialSize: CanvasTextSize;
  scale: number;
  rotation: number;
  style: CanvasTextEditorStyle;
  caretPoint?: CanvasPoint;
}

export interface CanvasTextEditResult extends CanvasTextSize {
  text: string;
}

export class CanvasInlineTextEditor {
  private readonly host: HTMLElement;
  private readonly metrics = new CanvasTextMetrics();
  private readonly caretMapper = new CanvasTextCaretMapper();
  private textarea: HTMLTextAreaElement | null = null;
  private resolve: ((value: CanvasTextEditResult | null) => void) | null = null;
  private request: CanvasTextEditRequest | null = null;
  private size: CanvasTextSize = { width: 80, height: 32 };

  constructor(host: HTMLElement) {
    this.host = host;
  }

  edit(request: CanvasTextEditRequest): Promise<CanvasTextEditResult | null> {
    this.cancel();
    this.request = request;
    this.size = { ...request.initialSize };
    const textarea = document.createElement("textarea");
    textarea.setAttribute("aria-label", "Canvas text");
    textarea.placeholder = "Type text";
    textarea.value = request.initialValue;
    textarea.wrap = "off";
    textarea.spellcheck = true;
    Object.assign(textarea.style, {
      position: "absolute",
      left: `${request.point.x}px`,
      top: `${request.point.y}px`,
      zIndex: "60",
      boxSizing: "border-box",
      padding: `${request.style.padding * request.scale}px`,
      border: "1.5px solid #3b82f6",
      borderRadius: "2px",
      outline: "none",
      overflow: "hidden",
      resize: "none",
      whiteSpace: "pre",
      background: "rgba(255, 255, 255, 0.96)",
      color: request.style.color,
      opacity: String(request.style.opacity),
      fontFamily: request.style.fontFamily,
      fontSize: `${request.style.fontSize * request.scale}px`,
      fontStyle: request.style.italic ? "italic" : "normal",
      fontWeight: request.style.fontWeight,
      letterSpacing: `${request.style.letterSpacing * request.scale}px`,
      lineHeight: `${request.style.lineHeight * request.scale}px`,
      textAlign: request.style.textAlign,
      transform: `rotate(${request.rotation}rad)`,
      transformOrigin: "center center",
      caretColor: "#1d4ed8",
      boxShadow: "0 0 0 1px rgba(59, 130, 246, 0.12)",
    });

    this.host.appendChild(textarea);
    this.textarea = textarea;
    this.applySize();

    return new Promise((resolve) => {
      this.resolve = resolve;
      textarea.addEventListener("keydown", this.onKeyDown);
      textarea.addEventListener("input", this.onInput);
      textarea.addEventListener("blur", this.onBlur);
      textarea.focus();
      const cursor = request.caretPoint
        ? this.caretMapper.indexAt(textarea.value, request.caretPoint, request, this.size)
        : textarea.value.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  commit(): void {
    const textarea = this.textarea;
    if (!textarea) {
      return;
    }
    this.finish({ text: textarea.value, ...this.size });
  }

  cancel(): void {
    this.finish(null);
  }

  destroy(): void {
    this.cancel();
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      this.commit();
    } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey || event.shiftKey)) {
      event.preventDefault();
      this.commit();
    }
  };

  private onInput = (): void => {
    this.resize();
  };

  private onBlur = (): void => {
    this.commit();
  };

  private resize(): void {
    if (!this.textarea || !this.request) {
      return;
    }
    this.size = this.metrics.measure(this.textarea.value, this.request.style);
    this.applySize();
  }

  private applySize(): void {
    if (!this.textarea || !this.request) {
      return;
    }
    this.textarea.style.width = `${this.size.width * this.request.scale}px`;
    this.textarea.style.height = `${this.size.height * this.request.scale}px`;
  }

  private finish(value: CanvasTextEditResult | null): void {
    const textarea = this.textarea;
    const resolve = this.resolve;
    if (!textarea && !resolve) {
      return;
    }
    this.textarea = null;
    this.resolve = null;
    this.request = null;
    textarea?.removeEventListener("keydown", this.onKeyDown);
    textarea?.removeEventListener("input", this.onInput);
    textarea?.removeEventListener("blur", this.onBlur);
    textarea?.remove();
    resolve?.(value);
  }
}
