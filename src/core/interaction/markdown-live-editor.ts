import { subscribeLatexRenderer } from "../latex/latex.ts";
import {
  flattenMarkdownInlineScopes,
  markdownBlockCss,
  markdownInlineScopeAt,
  markdownInlineScopes,
  markdownScopeAt,
  markdownSourceScopes,
  markdownTextRenderer,
  markdownTypography,
  type MarkdownInlineSourceScope,
  type MarkdownSourceScope,
} from "../markdown/index.ts";
import type {
  CanvasTextEditLayout,
  CanvasTextEditRequest,
  CanvasTextEditResult,
} from "./inline-text-editor.ts";

interface EditorSnapshot {
  source: string;
  anchor: number;
  focus: number;
  affinity: CaretAffinity;
}

type CaretAffinity = "before" | "after";

interface ActiveBounds {
  start: number;
  end: number;
  scopes: readonly MarkdownSourceScope[];
}

const css = `
  [data-md-rendered] { min-height: 1em; cursor: text; }
  ${markdownBlockCss("[data-md-rendered] ").join("\n")}
  [data-md-active] { min-height: 1em; white-space: pre-wrap; overflow-wrap: anywhere; outline: none; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', system-ui, sans-serif; }
  ${markdownBlockCss("[data-md-active] ").join("\n")}
  [data-md-active][data-placeholder]:empty::before { content: attr(data-placeholder); color: #94a3b8; pointer-events: none; }
  .canvas-md-link { color: #2563eb; text-decoration: underline; }
  .canvas-md-math { display: inline-flex; vertical-align: -.15em; }
  .canvas-md-math svg { color: currentColor; fill: currentColor; }
  .canvas-md-math-block { display: flex; max-width: 100%; margin: ${markdownTypography.displayMathMargin}; overflow: hidden; }
  .canvas-md-math-block .canvas-md-math { max-width: 100%; }
  .canvas-md-math-block svg { max-width: 100%; height: auto; }
  .canvas-md-math-pending { color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', system-ui, sans-serif; }
  .canvas-md-math-error { color: #dc2626; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', system-ui, sans-serif; }
  [data-md-inline-source] { cursor: text; }
  [data-md-caret-anchor] { display: inline-block; width: 0; min-width: 0; overflow: visible; white-space: nowrap; }
`;

export class CanvasMarkdownLiveEditor {
  private readonly host: HTMLElement;
  private root: HTMLDivElement | null = null;
  private request: CanvasTextEditRequest | null = null;
  private resolve: ((value: CanvasTextEditResult | null) => void) | null = null;
  private source = "";
  private anchor = 0;
  private focus = 0;
  private caretAffinity: CaretAffinity = "after";
  private size = { width: 80, height: 32 };
  private undoStack: EditorSnapshot[] = [];
  private redoStack: EditorSnapshot[] = [];
  private activeElement: HTMLElement | null = null;
  private activeBounds: ActiveBounds | null = null;
  private rendering = false;
  private composing = false;
  private inputSnapshotRecorded = false;
  private readonly unsubscribeLatex: () => void;

  constructor(host: HTMLElement) {
    this.host = host;
    this.unsubscribeLatex = subscribeLatexRenderer(() => {
      if (this.root) {
        this.render(true);
        this.notifyChange();
      }
    });
  }

  get editing(): boolean {
    return Boolean(this.root);
  }

  edit(request: CanvasTextEditRequest): Promise<CanvasTextEditResult | null> {
    this.cancel();
    this.request = request;
    this.source = request.initialValue;
    this.anchor = this.focus = request.initialValue.length;
    this.caretAffinity = "after";
    this.size = { ...request.initialSize };
    this.undoStack = [];
    this.redoStack = [];
    const root = document.createElement("div");
    root.dataset.canvasEditorAppearance = "markdown-live-preview";
    root.dataset.canvasUi = "true";
    root.setAttribute("aria-label", "Markdown live preview");
    root.setAttribute("role", "textbox");
    root.setAttribute("aria-multiline", "true");
    Object.assign(root.style, {
      position: "absolute",
      zIndex: "60",
      boxSizing: "border-box",
      border: "2px solid #3b82f6",
      outline: "none",
      overflow: "hidden",
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
    root.addEventListener("focusout", this.onFocusOut);
    root.addEventListener("pointerdown", this.onPointerDown);
    this.host.appendChild(root);
    this.root = root;
    this.applyLayout();
    document.addEventListener("selectionchange", this.onSelectionChange);
    this.render(true);
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  commit(): void {
    if (this.root) this.finish({ text: this.source, ...this.size });
  }

  cancel(): void {
    if (this.root || this.resolve) this.finish(null);
  }

  destroy(): void {
    this.cancel();
    this.unsubscribeLatex();
  }

  updateLayout(layout: CanvasTextEditLayout): void {
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
    this.updateSize(false);
  }

  private render(focusEditor: boolean): void {
    const root = this.root;
    const request = this.request;
    if (!root || !request) return;
    const shouldFocus = focusEditor || root.contains(document.activeElement);
    this.rendering = true;
    const scopes = markdownSourceScopes(this.source);
    const bounds = this.boundsForSelection(scopes);
    root.replaceChildren();
    const style = document.createElement("style");
    style.textContent = css;
    root.appendChild(style);
    for (const scope of scopes.filter(
      (candidate) => !bounds.scopes.includes(candidate) && candidate.end <= bounds.start,
    )) {
      root.appendChild(this.renderedScope(scope));
    }
    const active = document.createElement("div");
    active.dataset.mdActive = "true";
    active.dataset.sourceStart = String(bounds.start);
    if (!this.source) active.dataset.placeholder = "Write Markdown";
    active.contentEditable = "true";
    active.spellcheck = true;
    active.addEventListener("keydown", this.onKeyDown);
    active.addEventListener("beforeinput", this.onBeforeInput);
    active.addEventListener("input", this.onInput);
    active.addEventListener("compositionstart", this.onCompositionStart);
    active.addEventListener("compositionend", this.onCompositionEnd);
    active.addEventListener("paste", this.onPaste);
    this.appendActiveSource(active, bounds);
    root.appendChild(active);
    for (const scope of scopes.filter(
      (candidate) => !bounds.scopes.includes(candidate) && candidate.start >= bounds.end,
    )) {
      root.appendChild(this.renderedScope(scope));
    }
    this.activeElement = active;
    this.activeBounds = bounds;
    this.updateSize(false);
    if (shouldFocus) {
      active.focus({ preventScroll: true });
      this.restoreSelection(active, bounds.start);
    }
    this.rendering = false;
  }

  private renderedScope(scope: MarkdownSourceScope): HTMLElement {
    const element = document.createElement("div");
    element.dataset.mdRendered = "true";
    element.dataset.sourceStart = String(scope.start);
    element.dataset.sourceEnd = String(scope.end);
    element.innerHTML = scope.source.trimEnd()
      ? markdownTextRenderer.htmlFor(scope.source)
      : "<br>";
    return element;
  }

  private appendActiveSource(target: HTMLElement, bounds: ActiveBounds): void {
    const eligible = bounds.scopes.filter(
      (scope) => scope.kind !== "fence" && scope.kind !== "indented-code",
    );
    const scopes = eligible.flatMap((scope) =>
      markdownInlineScopes(this.source.slice(scope.start, scope.end), scope.start),
    );
    const active = this.anchor === this.focus ? markdownInlineScopeAt(scopes, this.focus) : null;
    let cursor = bounds.start;
    for (const scope of scopes) {
      if (scope.start < cursor || scope.end > bounds.end) continue;
      target.appendChild(document.createTextNode(this.source.slice(cursor, scope.start)));
      if (active && this.scopeContains(scope, active)) {
        this.appendScopeWithActive(target, scope, active);
      } else if (this.selectionIntersectsScope(scope)) {
        target.appendChild(document.createTextNode(scope.source));
      } else {
        this.appendRenderedInlineScope(target, scope);
      }
      cursor = scope.end;
    }
    const remainder = this.source.slice(cursor, bounds.end);
    if (remainder) target.appendChild(document.createTextNode(remainder));
  }

  private renderedInlineScope(scope: MarkdownInlineSourceScope): HTMLElement {
    const element = document.createElement("span");
    element.contentEditable = "false";
    element.dataset.mdInlineSource = scope.source;
    element.dataset.sourceStart = String(scope.start);
    element.dataset.sourceEnd = String(scope.end);
    element.dataset.contentStart = String(scope.contentStart);
    element.dataset.contentEnd = String(scope.contentEnd);
    element.dataset.scopeKind = scope.kind;
    element.innerHTML = markdownTextRenderer.htmlForInline(scope.source);
    return element;
  }

  private appendRenderedInlineScope(target: HTMLElement, scope: MarkdownInlineSourceScope): void {
    target.append(
      this.caretAnchor(scope.start, "before"),
      this.renderedInlineScope(scope),
      this.caretAnchor(scope.end, "after"),
    );
  }

  private caretAnchor(offset: number, affinity: CaretAffinity): HTMLElement {
    const anchor = document.createElement("span");
    anchor.contentEditable = "false";
    anchor.dataset.mdCaretAnchor = "true";
    anchor.dataset.sourceOffset = String(offset);
    anchor.dataset.caretAffinity = affinity;
    anchor.setAttribute("aria-hidden", "true");
    anchor.textContent = "\u200b";
    return anchor;
  }

  private appendScopeWithActive(
    target: HTMLElement,
    scope: MarkdownInlineSourceScope,
    active: MarkdownInlineSourceScope,
  ): void {
    if (scope === active) {
      target.appendChild(document.createTextNode(scope.source));
      return;
    }
    if (scope.kind === "link" || scope.kind === "code" || scope.kind === "math") {
      this.appendRenderedInlineScope(target, scope);
      return;
    }
    const wrapper = document.createElement(
      scope.kind === "strong"
        ? "strong"
        : scope.kind === "emphasis"
          ? "em"
          : scope.kind === "strikethrough"
            ? "s"
            : "strong",
    );
    if (scope.kind === "strong-emphasis") wrapper.style.fontStyle = "italic";
    wrapper.appendChild(this.virtualSource(scope.opening));
    let cursor = scope.contentStart;
    for (const child of scope.children) {
      wrapper.appendChild(document.createTextNode(this.source.slice(cursor, child.start)));
      if (this.scopeContains(child, active)) this.appendScopeWithActive(wrapper, child, active);
      else this.appendRenderedInlineScope(wrapper, child);
      cursor = child.end;
    }
    wrapper.appendChild(document.createTextNode(this.source.slice(cursor, scope.contentEnd)));
    wrapper.appendChild(this.virtualSource(scope.closing));
    target.appendChild(wrapper);
  }

  private virtualSource(source: string): HTMLElement {
    const marker = document.createElement("span");
    marker.contentEditable = "false";
    marker.dataset.mdInlineSource = source;
    marker.style.display = "none";
    return marker;
  }

  private scopeContains(
    parent: MarkdownInlineSourceScope,
    child: MarkdownInlineSourceScope,
  ): boolean {
    return child.start >= parent.start && child.end <= parent.end;
  }

  private boundsForSelection(scopes: readonly MarkdownSourceScope[]): ActiveBounds {
    if (scopes.length === 0) return { start: 0, end: 0, scopes: [] };
    const minimum = Math.min(this.anchor, this.focus);
    const maximum = Math.max(this.anchor, this.focus);
    const first = markdownScopeAt(scopes, minimum) ?? scopes[0];
    const last = markdownScopeAt(scopes, maximum) ?? first;
    const startIndex = scopes.indexOf(first);
    const endIndex = Math.max(startIndex, scopes.indexOf(last));
    const active = scopes.slice(startIndex, endIndex + 1);
    return { start: active[0].start, end: active.at(-1)!.end, scopes: active };
  }

  private selectionIntersectsScope(range: MarkdownInlineSourceScope): boolean {
    const minimum = Math.min(this.anchor, this.focus);
    const maximum = Math.max(this.anchor, this.focus);
    if (minimum === maximum) return minimum > range.start && minimum < range.end;
    return minimum < range.end && maximum > range.start;
  }

  private onPointerDown = (event: PointerEvent): void => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const inline = target?.closest<HTMLElement>("[data-md-inline-source]");
    if (inline) {
      event.preventDefault();
      const start = Number(inline.dataset.contentStart);
      const end = Number(inline.dataset.contentEnd);
      const bounds = inline.getBoundingClientRect();
      const fraction =
        bounds.width > 0
          ? Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width))
          : 0;
      this.anchor = this.focus =
        Number.isFinite(start) && Number.isFinite(end)
          ? start + Math.round((end - start) * fraction)
          : this.focus;
      this.caretAffinity = "after";
      this.render(true);
      return;
    }
    if (target === this.root) {
      event.preventDefault();
      this.anchor = this.focus = this.source.length;
      this.caretAffinity = "after";
      this.render(true);
      return;
    }
    const rendered = target?.closest<HTMLElement>("[data-md-rendered]");
    if (!rendered) return;
    event.preventDefault();
    const start = Number(rendered.dataset.sourceStart);
    const end = Number(rendered.dataset.sourceEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;
    const bounds = rendered.getBoundingClientRect();
    const fraction =
      bounds.width > 0 ? Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) : 1;
    const lineSource = this.source.slice(start, end).replace(/\n$/, "");
    this.anchor = this.focus = start + Math.round(lineSource.length * fraction);
    this.render(true);
  };

  private onBeforeInput = (event: InputEvent): void => {
    if (event.inputType === "historyUndo" || event.inputType === "historyRedo") {
      event.preventDefault();
      if (event.inputType === "historyUndo") this.undo();
      else this.redo();
      return;
    }
    if (event.inputType === "insertParagraph" || event.inputType === "insertLineBreak") {
      event.preventDefault();
      this.replaceSelection("\n");
      return;
    }
    if (!this.inputSnapshotRecorded) this.recordUndo();
    this.inputSnapshotRecorded = true;
  };

  private onInput = (event?: Event): void => {
    if (this.composing || (event as InputEvent | undefined)?.isComposing) {
      this.updateSize(false);
      return;
    }
    this.applyActiveInput();
  };

  private applyActiveInput(): void {
    const active = this.activeElement;
    const bounds = this.activeBounds;
    if (!active || !bounds) return;
    const selection = this.selectionOffsets(active, bounds.start);
    const next = this.sourceText(active);
    if (!this.inputSnapshotRecorded) this.recordUndo();
    this.inputSnapshotRecorded = false;
    this.source = this.source.slice(0, bounds.start) + next + this.source.slice(bounds.end);
    this.anchor = bounds.start + selection.anchor;
    this.focus = bounds.start + selection.focus;
    this.caretAffinity = "after";
    this.clampSelection();
    this.render(true);
    this.notifyChange();
  }

  private onCompositionStart = (): void => {
    this.composing = true;
  };

  private onCompositionEnd = (): void => {
    this.composing = false;
    this.applyActiveInput();
  };

  private onPaste = (event: ClipboardEvent): void => {
    const text = event.clipboardData?.getData("text/plain");
    if (text === undefined) return;
    event.preventDefault();
    this.replaceSelection(text);
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    event.stopPropagation();
    if (this.enterInlineScopeFromBoundary(event)) return;
    if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "a") {
      event.preventDefault();
      this.selectAllSource();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      this.commit();
      return;
    }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey || event.shiftKey)) {
      event.preventDefault();
      this.commit();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      this.replaceSelection("\n");
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      this.moveVertically(event.key === "ArrowUp" ? -1 : 1, event.shiftKey);
    }
  };

  private selectAllSource(): void {
    this.anchor = 0;
    this.focus = this.source.length;
    this.render(true);
  }

  private onSelectionChange = (): void => {
    if (this.rendering || this.composing || !this.activeElement || !this.activeBounds) return;
    const selection = document.getSelection();
    if (!selection?.anchorNode || !selection.focusNode) return;
    if (
      !this.activeElement.contains(selection.anchorNode) ||
      !this.activeElement.contains(selection.focusNode)
    )
      return;
    const previousScope = this.focusedInlineKey();
    const offsets = this.selectionOffsets(this.activeElement, this.activeBounds.start);
    this.anchor = this.activeBounds.start + offsets.anchor;
    this.focus = this.activeBounds.start + offsets.focus;
    this.caretAffinity = this.affinityAtSelection() ?? this.caretAffinity;
    this.clampSelection();
    if (previousScope !== this.focusedInlineKey()) this.render(true);
  };

  private onFocusOut = (): void => {
    queueMicrotask(() => {
      if (!this.root || this.rendering) return;
      if (!this.root.contains(document.activeElement)) this.commit();
    });
  };

  private replaceSelection(text: string): void {
    this.recordUndo();
    const minimum = Math.min(this.anchor, this.focus);
    const maximum = Math.max(this.anchor, this.focus);
    this.source = this.source.slice(0, minimum) + text + this.source.slice(maximum);
    this.anchor = this.focus = minimum + text.length;
    this.caretAffinity = "after";
    this.render(true);
    this.notifyChange();
  }

  private moveVertically(direction: -1 | 1, extend: boolean): void {
    const moving = this.focus;
    const before = this.source.slice(0, moving);
    const lineStart = before.lastIndexOf("\n") + 1;
    const column = moving - lineStart;
    let next = moving;
    if (direction < 0) {
      if (lineStart === 0) return;
      const previousEnd = lineStart - 1;
      const previousStart = this.source.lastIndexOf("\n", previousEnd - 1) + 1;
      next = previousStart + Math.min(column, previousEnd - previousStart);
    } else {
      const lineEnd = this.source.indexOf("\n", moving);
      if (lineEnd < 0) return;
      const nextStart = lineEnd + 1;
      const nextEnd = this.source.indexOf("\n", nextStart);
      const boundedEnd = nextEnd < 0 ? this.source.length : nextEnd;
      next = nextStart + Math.min(column, boundedEnd - nextStart);
    }
    if (!extend) this.anchor = next;
    this.focus = next;
    this.caretAffinity = direction < 0 ? "before" : "after";
    this.render(true);
  }

  private undo(): void {
    const snapshot = this.undoStack.pop();
    if (!snapshot) return;
    this.redoStack.push(this.snapshot());
    this.restoreSnapshot(snapshot);
  }

  private redo(): void {
    const snapshot = this.redoStack.pop();
    if (!snapshot) return;
    this.undoStack.push(this.snapshot());
    this.restoreSnapshot(snapshot);
  }

  private recordUndo(): void {
    const snapshot = this.snapshot();
    const previous = this.undoStack.at(-1);
    if (
      !previous ||
      previous.source !== snapshot.source ||
      previous.anchor !== snapshot.anchor ||
      previous.focus !== snapshot.focus ||
      previous.affinity !== snapshot.affinity
    ) {
      this.undoStack.push(snapshot);
      if (this.undoStack.length > 200) this.undoStack.shift();
    }
    this.redoStack = [];
  }

  private snapshot(): EditorSnapshot {
    return {
      source: this.source,
      anchor: this.anchor,
      focus: this.focus,
      affinity: this.caretAffinity,
    };
  }

  private restoreSnapshot(snapshot: EditorSnapshot): void {
    this.source = snapshot.source;
    this.anchor = snapshot.anchor;
    this.focus = snapshot.focus;
    this.caretAffinity = snapshot.affinity;
    this.render(true);
    this.notifyChange();
  }

  private focusedInlineKey(): string {
    if (this.anchor !== this.focus) return "";
    const range = markdownInlineScopeAt(markdownInlineScopes(this.source), this.focus);
    return range ? `${range.kind}:${range.start}:${range.end}` : "";
  }

  private enterInlineScopeFromBoundary(event: KeyboardEvent): boolean {
    if (this.anchor !== this.focus || event.metaKey || event.ctrlKey || event.altKey) return false;
    const backward = event.key === "ArrowLeft" || event.key === "Backspace";
    const forward = event.key === "ArrowRight" || event.key === "Delete";
    if (!backward && !forward) return false;
    const scopes = flattenMarkdownInlineScopes(markdownInlineScopes(this.source));
    const scope = scopes
      .filter((candidate) =>
        backward ? candidate.end === this.focus : candidate.start === this.focus,
      )
      .sort((left, right) => left.end - left.start - (right.end - right.start))[0];
    if (!scope) return false;
    event.preventDefault();
    this.anchor = this.focus = backward ? scope.contentEnd : scope.contentStart;
    this.caretAffinity = backward ? "before" : "after";
    this.render(true);
    return true;
  }

  private notifyChange(): void {
    this.updateSize(false);
    this.request?.onChange?.({ text: this.source, ...this.size });
  }

  private updateSize(notify: boolean): void {
    const root = this.root;
    const request = this.request;
    if (!root || !request) return;
    root.style.height = "auto";
    const height = Math.max(
      this.size.height,
      request.minHeight ?? request.initialSize.height,
      Math.ceil(root.scrollHeight / Math.max(request.scale, 0.001)),
    );
    this.size = { width: request.initialSize.width, height };
    root.style.height = `${height * request.scale}px`;
    if (notify) request.onChange?.({ text: this.source, ...this.size });
  }

  private applyLayout(): void {
    const root = this.root;
    const request = this.request;
    if (!root || !request) return;
    const { point, scale, rotation, style } = request;
    Object.assign(root.style, {
      left: `${point.x}px`,
      top: `${point.y}px`,
      width: `${request.initialSize.width * scale}px`,
      height: `${Math.max(this.size.height, request.initialSize.height) * scale}px`,
      minHeight: `${(request.minHeight ?? request.initialSize.height) * scale}px`,
      borderRadius: `${(request.borderRadius ?? 0) * scale}px`,
      padding: `${style.padding * scale}px`,
      fontSize: `${style.fontSize * scale}px`,
      letterSpacing: `${style.letterSpacing * scale}px`,
      lineHeight: `${style.lineHeight * scale}px`,
      transform: `rotate(${rotation}rad)`,
    });
  }

  private selectionOffsets(root: HTMLElement, base: number): { anchor: number; focus: number } {
    const selection = document.getSelection();
    if (!selection?.anchorNode || !selection.focusNode) {
      const fallback = Math.max(0, this.focus - base);
      return { anchor: fallback, focus: fallback };
    }
    return {
      anchor: this.domOffset(root, selection.anchorNode, selection.anchorOffset),
      focus: this.domOffset(root, selection.focusNode, selection.focusOffset),
    };
  }

  private domOffset(root: Node, target: Node, offset: number): number {
    let total = 0;
    let found = false;
    const visit = (node: Node): void => {
      if (found) return;
      if (node === target) {
        if (node.nodeType === Node.TEXT_NODE)
          total += Math.min(offset, node.textContent?.length ?? 0);
        else
          for (let index = 0; index < Math.min(offset, node.childNodes.length); index++)
            total += this.sourceLength(node.childNodes[index]);
        found = true;
        return;
      }
      if (node.nodeType === Node.TEXT_NODE) {
        total += node.textContent?.length ?? 0;
        return;
      }
      const element = node instanceof HTMLElement ? node : null;
      if (element?.dataset.mdCaretAnchor !== undefined) return;
      if (element?.dataset.mdInlineSource !== undefined) {
        total += element.dataset.mdInlineSource.length;
        return;
      }
      for (const child of node.childNodes) visit(child);
    };
    visit(root);
    return total;
  }

  private sourceLength(node: Node): number {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent?.length ?? 0;
    const element = node instanceof HTMLElement ? node : null;
    if (element?.dataset.mdCaretAnchor !== undefined) return 0;
    if (element?.dataset.mdInlineSource !== undefined) return element.dataset.mdInlineSource.length;
    let length = 0;
    for (const child of node.childNodes) length += this.sourceLength(child);
    return length;
  }

  private sourceText(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE)
      return node.textContent === "\u200b" ? "" : (node.textContent ?? "");
    const element = node instanceof HTMLElement ? node : null;
    if (element?.dataset.mdCaretAnchor !== undefined) return "";
    if (element?.dataset.mdInlineSource !== undefined) return element.dataset.mdInlineSource;
    if (element?.tagName === "BR") return "\n";
    let value = "";
    for (const child of node.childNodes) value += this.sourceText(child);
    return value;
  }

  private restoreSelection(root: HTMLElement, base: number): void {
    const selection = document.getSelection();
    if (!selection) return;
    const anchor = this.domPoint(
      root,
      Math.max(0, this.anchor - base),
      this.anchor,
      this.caretAffinity,
    );
    const focus = this.domPoint(
      root,
      Math.max(0, this.focus - base),
      this.focus,
      this.caretAffinity,
    );
    selection.removeAllRanges();
    const range = document.createRange();
    range.setStart(anchor.node, anchor.offset);
    range.collapse(true);
    selection.addRange(range);
    if (this.anchor !== this.focus && typeof selection.extend === "function") {
      selection.extend(focus.node, focus.offset);
    }
  }

  private domPoint(
    root: HTMLElement,
    requested: number,
    sourceOffset: number,
    affinity: CaretAffinity,
  ): { node: Node; offset: number } {
    const explicitAnchor = [...root.querySelectorAll<HTMLElement>("[data-md-caret-anchor]")].find(
      (candidate) =>
        Number(candidate.dataset.sourceOffset) === sourceOffset &&
        candidate.dataset.caretAffinity === affinity,
    );
    if (explicitAnchor?.parentNode) {
      const index = [...explicitAnchor.parentNode.childNodes].indexOf(explicitAnchor);
      return { node: explicitAnchor.parentNode, offset: index + 1 };
    }
    let remaining = requested;
    const walk = (node: Node): { node: Node; offset: number } | null => {
      if (node.nodeType === Node.TEXT_NODE) {
        const length = node.textContent?.length ?? 0;
        if (remaining <= length) return { node, offset: remaining };
        remaining -= length;
        return null;
      }
      const element = node instanceof HTMLElement ? node : null;
      if (element?.dataset.mdCaretAnchor !== undefined) return null;
      if (element?.dataset.mdInlineSource !== undefined) return null;
      for (let index = 0; index < node.childNodes.length; index++) {
        const child = node.childNodes[index];
        const inline = child instanceof HTMLElement ? child.dataset.mdInlineSource : undefined;
        if (inline !== undefined) {
          if (remaining <= inline.length)
            return { node, offset: remaining < inline.length / 2 ? index : index + 1 };
          remaining -= inline.length;
          continue;
        }
        const point = walk(child);
        if (point) return point;
      }
      return null;
    };
    return walk(root) ?? { node: root, offset: root.childNodes.length };
  }

  private affinityAtSelection(): CaretAffinity | null {
    const selection = document.getSelection();
    if (!selection?.focusNode) return null;
    const node = selection.focusNode;
    if (node instanceof HTMLElement && node.dataset.mdCaretAnchor !== undefined) {
      return node.dataset.caretAffinity === "before" ? "before" : "after";
    }
    if (
      node.nodeType === Node.TEXT_NODE &&
      node.parentElement?.dataset.mdCaretAnchor !== undefined
    ) {
      return node.parentElement.dataset.caretAffinity === "before" ? "before" : "after";
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const child = node.childNodes[Math.max(0, selection.focusOffset - 1)];
      if (child instanceof HTMLElement && child.dataset.mdCaretAnchor !== undefined) {
        return child.dataset.caretAffinity === "before" ? "before" : "after";
      }
    }
    return null;
  }

  private clampSelection(): void {
    this.anchor = Math.max(0, Math.min(this.source.length, this.anchor));
    this.focus = Math.max(0, Math.min(this.source.length, this.focus));
  }

  private finish(value: CanvasTextEditResult | null): void {
    const root = this.root;
    const resolve = this.resolve;
    this.root = null;
    this.request = null;
    this.resolve = null;
    this.activeElement = null;
    this.activeBounds = null;
    document.removeEventListener("selectionchange", this.onSelectionChange);
    if (root) {
      root.removeEventListener("focusout", this.onFocusOut);
      root.removeEventListener("pointerdown", this.onPointerDown);
      root.remove();
    }
    resolve?.(value);
  }
}
