import type { CanvasPoint } from "../types";
import { CanvasTextMetrics, type CanvasTextEditorStyle, type CanvasTextSize } from "./text-metrics";
import { CanvasTextCaretMapper } from "./text-caret-mapper";
import { CanvasMarkdownLiveEditor } from "./markdown-live-editor.ts";

export interface CanvasTextEditRequest {
  point: CanvasPoint;
  initialValue: string;
  initialSize: CanvasTextSize;
  scale: number;
  rotation: number;
  style: CanvasTextEditorStyle;
  caretPoint?: CanvasPoint;
  sizing?: "auto" | "fixed";
  minHeight?: number;
  appearance?: "text" | "markdown-source" | "markdown-live-preview";
  background?: string;
  borderRadius?: number;
  onChange?: (value: CanvasTextEditResult) => void;
}

export type CanvasTextEditLayout = Pick<CanvasTextEditRequest, "point" | "scale" | "rotation"> & {
  width?: number;
  height?: number;
  minHeight?: number;
  background?: string;
  borderRadius?: number;
};

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
  private readonly markdownEditor: CanvasMarkdownLiveEditor;

  constructor(host: HTMLElement) {
    this.host = host;
    this.markdownEditor = new CanvasMarkdownLiveEditor(host);
  }

  edit(request: CanvasTextEditRequest): Promise<CanvasTextEditResult | null> {
    this.cancel();
    if (request.appearance === "markdown-live-preview") {
      return this.markdownEditor.edit(request);
    }
    this.request = request;
    this.size = { ...request.initialSize };
    const textarea = document.createElement("textarea");
    const markdownSource = request.appearance === "markdown-source";
    textarea.setAttribute("aria-label", markdownSource ? "Markdown source" : "Canvas text");
    textarea.dataset.canvasEditorAppearance = request.appearance ?? "text";
    textarea.placeholder = markdownSource ? "Write Markdown" : "Type text";
    textarea.value = request.initialValue;
    textarea.wrap = "off";
    textarea.spellcheck = true;
    Object.assign(textarea.style, {
      position: "absolute",
      zIndex: "60",
      boxSizing: "border-box",
      border: markdownSource ? "none" : "1.5px solid #3b82f6",
      borderRadius: markdownSource ? "0" : "2px",
      outline: "none",
      overflow: "hidden",
      resize: "none",
      whiteSpace: "pre",
      overflowWrap: "normal",
      background: "transparent",
      color: request.style.color,
      opacity: String(request.style.opacity),
      fontFamily: request.style.fontFamily,
      fontStyle: request.style.italic ? "italic" : "normal",
      fontWeight: request.style.fontWeight,
      textAlign: request.style.textAlign,
      transformOrigin: "center center",
      caretColor: "#1d4ed8",
      boxShadow: "none",
    });

    this.host.appendChild(textarea);
    this.textarea = textarea;
    this.applyLayout();
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
    if (this.markdownEditor.editing) {
      this.markdownEditor.commit();
      return;
    }
    const textarea = this.textarea;
    if (!textarea) {
      return;
    }
    this.finish({ text: textarea.value, ...this.size });
  }

  cancel(): void {
    if (this.markdownEditor.editing) this.markdownEditor.cancel();
    this.finish(null);
  }

  destroy(): void {
    this.cancel();
    this.markdownEditor.destroy();
  }

  updateLayout(layout: CanvasTextEditLayout): void {
    if (this.markdownEditor.editing) {
      this.markdownEditor.updateLayout(layout);
      return;
    }
    if (!this.request) return;
    this.request = {
      ...this.request,
      point: layout.point,
      scale: layout.scale,
      rotation: layout.rotation,
      initialSize: {
        ...this.request.initialSize,
        width: layout.width ?? this.request.initialSize.width,
        height: layout.height ?? this.request.initialSize.height,
      },
      minHeight: layout.minHeight ?? this.request.minHeight,
      background: layout.background ?? this.request.background,
      borderRadius: layout.borderRadius ?? this.request.borderRadius,
    };
    this.applyLayout();
    this.applySize();
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
    if (!this.textarea || !this.request) return;
    this.request.onChange?.({ text: this.textarea.value, ...this.size });
  };

  private onBlur = (): void => {
    this.commit();
  };

  private resize(): void {
    if (!this.textarea || !this.request) {
      return;
    }
    const measured = this.metrics.measure(this.textarea.value, this.request.style);
    this.size = {
      width: Math.max(this.size.width, this.request.initialSize.width, measured.width),
      height: Math.max(
        this.size.height,
        this.request.minHeight ?? this.request.initialSize.height,
        measured.height,
      ),
    };
    this.applySize();
  }

  private applySize(): void {
    if (!this.textarea || !this.request) {
      return;
    }
    this.textarea.style.width = `${this.size.width * this.request.scale}px`;
    this.textarea.style.height = `${this.size.height * this.request.scale}px`;
  }

  private applyLayout(): void {
    if (!this.textarea || !this.request) return;
    const { point, scale, rotation, style } = this.request;
    Object.assign(this.textarea.style, {
      left: `${point.x}px`,
      top: `${point.y}px`,
      padding: `${style.padding * scale}px`,
      fontSize: `${style.fontSize * scale}px`,
      letterSpacing: `${style.letterSpacing * scale}px`,
      lineHeight: `${style.lineHeight * scale}px`,
      transform: `rotate(${rotation}rad)`,
    });
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
