import type { CanvasElement } from "../types/elements";

export type TextEditTarget = {
  cardId: string;
  elementId: string;
};

export type TextSelection = {
  anchor: number;
  focus: number;
};

export type TextEditState = {
  target: TextEditTarget;

  text: string;

  selection: TextSelection;

  composing: boolean;
};

export interface CanvasTextEditorOptions {
  getElement(
    cardId: string,
    elementId: string,
  ): CanvasElement | undefined;

  updateElementText(
    cardId: string,
    elementId: string,
    text: string,
  ): void;

  beginHistory(): void;
  commitHistory(): void;
  cancelHistory(): void;

  refresh(): void;
  scheduleSave(): void;
}

export class CanvasTextEditor {
  private state: TextEditState | null = null;

  private readonly options: CanvasTextEditorOptions;
  constructor(
    options: CanvasTextEditorOptions
  ) {
    this.options = options
  }

  get active(): boolean {
    return this.state !== null;
  }

  get current(): Readonly<TextEditState> | null {
    return this.state;
  }

  get text(): string {
    return this.state?.text ?? "";
  }

  get selectionStart(): number {
    if (!this.state) {
      return 0;
    }

    return Math.min(
      this.state.selection.anchor,
      this.state.selection.focus,
    );
  }

  get selectionEnd(): number {
    if (!this.state) {
      return 0;
    }

    return Math.max(
      this.state.selection.anchor,
      this.state.selection.focus,
    );
  }

  get hasSelection(): boolean {
    return this.selectionStart !== this.selectionEnd;
  }

  start(
    target: TextEditTarget,
    cursor?: number,
  ): void {
    this.commit();

    const element = this.options.getElement(
      target.cardId,
      target.elementId,
    );

    if (!element || element.type !== "text") {
      return;
    }

    const text = element.text ?? "";

    const position =
      cursor ?? text.length;

    this.options.beginHistory();

    this.state = {
      target,

      text,

      selection: {
        anchor: position,
        focus: position,
      },

      composing: false,
    };

    this.options.refresh();
  }

  commit(): void {
    if (!this.state) {
      return;
    }

    this.flushText();

    this.state = null;

    this.options.commitHistory();
    this.options.scheduleSave();
    this.options.refresh();
  }

  cancel(): void {
    if (!this.state) {
      return;
    }

    this.state = null;

    this.options.cancelHistory();
    this.options.refresh();
  }

  setSelection(
    anchor: number,
    focus = anchor,
  ): void {
    const state = this.state;

    if (!state) {
      return;
    }

    const length = state.text.length;

    state.selection.anchor =
      clamp(anchor, 0, length);

    state.selection.focus =
      clamp(focus, 0, length);

    this.options.refresh();
  }

  selectAll(): void {
    const state = this.state;

    if (!state) {
      return;
    }

    state.selection.anchor = 0;
    state.selection.focus =
      state.text.length;

    this.options.refresh();
  }

  collapseSelection(
    direction: "start" | "end",
  ): void {
    const state = this.state;

    if (!state) {
      return;
    }

    const position =
      direction === "start"
        ? this.selectionStart
        : this.selectionEnd;

    state.selection.anchor = position;
    state.selection.focus = position;

    this.options.refresh();
  }

  replaceSelection(
    replacement: string,
  ): void {
    const state = this.state;

    if (!state) {
      return;
    }

    const start = this.selectionStart;
    const end = this.selectionEnd;

    state.text =
      state.text.slice(0, start) +
      replacement +
      state.text.slice(end);

    const cursor =
      start + replacement.length;

    state.selection.anchor = cursor;
    state.selection.focus = cursor;

    this.flushText();
    this.options.refresh();
  }

  insert(text: string): void {
    this.replaceSelection(text);
  }

  deleteBackward(): void {
    const state = this.state;

    if (!state) {
      return;
    }

    if (this.hasSelection) {
      this.replaceSelection("");
      return;
    }

    const cursor =
      state.selection.focus;

    if (cursor <= 0) {
      return;
    }

    const previous =
      previousCodePointIndex(
        state.text,
        cursor,
      );

    state.selection.anchor = previous;
    state.selection.focus = cursor;

    this.replaceSelection("");
  }

  deleteForward(): void {
    const state = this.state;

    if (!state) {
      return;
    }

    if (this.hasSelection) {
      this.replaceSelection("");
      return;
    }

    const cursor =
      state.selection.focus;

    if (cursor >= state.text.length) {
      return;
    }

    const next =
      nextCodePointIndex(
        state.text,
        cursor,
      );

    state.selection.anchor = cursor;
    state.selection.focus = next;

    this.replaceSelection("");
  }

  deleteWordBackward(): void {
    const state = this.state;

    if (!state) {
      return;
    }

    if (this.hasSelection) {
      this.replaceSelection("");
      return;
    }

    const cursor =
      state.selection.focus;

    const start =
      previousWordBoundary(
        state.text,
        cursor,
      );

    state.selection.anchor = start;
    state.selection.focus = cursor;

    this.replaceSelection("");
  }

  deleteWordForward(): void {
    const state = this.state;

    if (!state) {
      return;
    }

    if (this.hasSelection) {
      this.replaceSelection("");
      return;
    }

    const cursor =
      state.selection.focus;

    const end =
      nextWordBoundary(
        state.text,
        cursor,
      );

    state.selection.anchor = cursor;
    state.selection.focus = end;

    this.replaceSelection("");
  }

  moveCursor(
    direction:
      | "left"
      | "right"
      | "word-left"
      | "word-right"
      | "start"
      | "end",
    extend = false,
  ): void {
    const state = this.state;

    if (!state) {
      return;
    }

    const current =
      state.selection.focus;

    let next = current;

    switch (direction) {
      case "left":
        next = previousCodePointIndex(
          state.text,
          current,
        );
        break;

      case "right":
        next = nextCodePointIndex(
          state.text,
          current,
        );
        break;

      case "word-left":
        next = previousWordBoundary(
          state.text,
          current,
        );
        break;

      case "word-right":
        next = nextWordBoundary(
          state.text,
          current,
        );
        break;

      case "start":
        next = 0;
        break;

      case "end":
        next = state.text.length;
        break;
    }

    if (extend) {
      state.selection.focus = next;
    } else {
      state.selection.anchor = next;
      state.selection.focus = next;
    }

    this.options.refresh();
  }

  setComposing(
    composing: boolean,
  ): void {
    if (!this.state) {
      return;
    }

    this.state.composing =
      composing;
  }

  private flushText(): void {
    const state = this.state;

    if (!state) {
      return;
    }

    this.options.updateElementText(
      state.target.cardId,
      state.target.elementId,
      state.text,
    );
  }
}

function previousWordBoundary(
  text: string,
  index: number,
): number {
  let cursor = clamp(
    index,
    0,
    text.length,
  );

  while (
    cursor > 0 &&
    /\s/.test(
      text[cursor - 1],
    )
  ) {
    cursor--;
  }

  while (
    cursor > 0 &&
    !/\s/.test(
      text[cursor - 1],
    )
  ) {
    cursor--;
  }

  return cursor;
}

function nextWordBoundary(
  text: string,
  index: number,
): number {
  let cursor = clamp(
    index,
    0,
    text.length,
  );

  while (
    cursor < text.length &&
    /\s/.test(
      text[cursor],
    )
  ) {
    cursor++;
  }

  while (
    cursor < text.length &&
    !/\s/.test(
      text[cursor],
    )
  ) {
    cursor++;
  }

  return cursor;
}

function previousCodePointIndex(
  text: string,
  index: number,
): number {
  if (index <= 0) {
    return 0;
  }

  const previous =
    text.codePointAt(index - 1);

  if (
    previous !== undefined &&
    previous >= 0xdc00 &&
    previous <= 0xdfff &&
    index >= 2
  ) {
    return index - 2;
  }

  return index - 1;
}

function nextCodePointIndex(
  text: string,
  index: number,
): number {
  if (index >= text.length) {
    return text.length;
  }

  const codePoint =
    text.codePointAt(index);

  if (
    codePoint !== undefined &&
    codePoint > 0xffff
  ) {
    return Math.min(
      text.length,
      index + 2,
    );
  }

  return index + 1;
}

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.max(
    min,
    Math.min(max, value),
  );
}
