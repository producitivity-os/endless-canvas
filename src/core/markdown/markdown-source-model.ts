export interface MarkdownSourceScope {
  start: number;
  end: number;
  startLine: number;
  endLine: number;
  kind: "line" | "fence" | "math-block" | "list" | "blockquote" | "indented-code";
  source: string;
}

export interface MarkdownInlineMathRange {
  start: number;
  end: number;
  contentStart: number;
  contentEnd: number;
  source: string;
  content: string;
  closed: boolean;
}

export type MarkdownInlineScopeKind =
  "strong" | "emphasis" | "strong-emphasis" | "strikethrough" | "code" | "link" | "math";

export interface MarkdownInlineSourceScope {
  start: number;
  end: number;
  contentStart: number;
  contentEnd: number;
  source: string;
  content: string;
  opening: string;
  closing: string;
  kind: MarkdownInlineScopeKind;
  children: MarkdownInlineSourceScope[];
}

interface SourceLine {
  start: number;
  end: number;
  contentEnd: number;
  value: string;
}

const listMarker = /^ {0,3}(?:[-+*]|\d+[.)])\s+/;
const blockquoteMarker = /^ {0,3}>\s?/;
const indentedCode = /^(?: {4}|\t)/;
const fenceMarker = /^ {0,3}(`{3,}|~{3,})/;

function displayMathDelimiter(value: string): { opening: string; closing: string } | null {
  const trimmed = value.replace(/^ {0,3}/, "");
  if (trimmed.startsWith("$$")) return { opening: "$$", closing: "$$" };
  if (trimmed.startsWith("\\[")) return { opening: "\\[", closing: "\\]" };
  return null;
}

export function markdownSourceScopes(source: string): MarkdownSourceScope[] {
  const lines = sourceLines(source);
  const scopes: MarkdownSourceScope[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const displayMath = displayMathDelimiter(line.value);
    if (displayMath) {
      const trimmed = line.value.replace(/^ {0,3}/, "");
      const remainder = trimmed.slice(displayMath.opening.length);
      const sameLineClose = remainder.indexOf(displayMath.closing);
      let end = index + 1;
      if (sameLineClose < 0) {
        while (end < lines.length) {
          const closingLine = lines[end].value;
          end++;
          if (closingLine.includes(displayMath.closing)) break;
        }
      }
      scopes.push(scopeFromLines(source, lines, index, end, "math-block"));
      index = end;
      continue;
    }
    const fence = line.value.match(fenceMarker)?.[1];
    if (fence) {
      const marker = fence[0];
      const minimum = fence.length;
      let end = index + 1;
      while (end < lines.length) {
        const closing = lines[end].value.match(fenceMarker)?.[1];
        end++;
        if (closing?.[0] === marker && closing.length >= minimum) break;
      }
      scopes.push(scopeFromLines(source, lines, index, end, "fence"));
      index = end;
      continue;
    }
    if (listMarker.test(line.value)) {
      let end = index + 1;
      while (end < lines.length) {
        const value = lines[end].value;
        if (listMarker.test(value) || value.trim() === "" || /^(?: {2,}|\t)/.test(value)) end++;
        else break;
      }
      while (end > index + 1 && lines[end - 1].value.trim() === "") end--;
      scopes.push(scopeFromLines(source, lines, index, end, "list"));
      index = end;
      continue;
    }
    if (blockquoteMarker.test(line.value)) {
      let end = index + 1;
      while (end < lines.length && blockquoteMarker.test(lines[end].value)) end++;
      scopes.push(scopeFromLines(source, lines, index, end, "blockquote"));
      index = end;
      continue;
    }
    if (indentedCode.test(line.value)) {
      let end = index + 1;
      while (
        end < lines.length &&
        (indentedCode.test(lines[end].value) || lines[end].value.trim() === "")
      )
        end++;
      while (end > index + 1 && lines[end - 1].value.trim() === "") end--;
      scopes.push(scopeFromLines(source, lines, index, end, "indented-code"));
      index = end;
      continue;
    }
    scopes.push(scopeFromLines(source, lines, index, index + 1, "line"));
    index++;
  }
  return scopes;
}

export function markdownScopeAt(
  scopes: readonly MarkdownSourceScope[],
  offset: number,
): MarkdownSourceScope | null {
  if (scopes.length === 0) return null;
  const clamped = Math.max(0, offset);
  return (
    scopes.find(
      (scope, index) =>
        clamped >= scope.start &&
        (clamped < scope.end || (index === scopes.length - 1 && clamped === scope.end)),
    ) ??
    scopes.at(-1) ??
    null
  );
}

export function markdownInlineMathRanges(
  source: string,
  baseOffset = 0,
): MarkdownInlineMathRange[] {
  const ranges: MarkdownInlineMathRange[] = [];
  let cursor = 0;
  while (cursor < source.length) {
    const dollar =
      source[cursor] === "$" &&
      source[cursor - 1] !== "$" &&
      source[cursor + 1] !== "$" &&
      !isEscaped(source, cursor);
    const parenthesized = source.startsWith("\\(", cursor) && !isEscaped(source, cursor);
    if (!dollar && !parenthesized) {
      cursor++;
      continue;
    }
    const start = cursor;
    const openingSize = parenthesized ? 2 : 1;
    const closing = parenthesized ? "\\)" : "$";
    let closed = false;
    cursor += openingSize;
    while (cursor < source.length && source[cursor] !== "\n") {
      if (
        source.startsWith(closing, cursor) &&
        (parenthesized || (source[cursor - 1] !== "$" && source[cursor + 1] !== "$")) &&
        !isEscaped(source, cursor)
      ) {
        const end = cursor + closing.length;
        ranges.push({
          start: baseOffset + start,
          end: baseOffset + end,
          contentStart: baseOffset + start + openingSize,
          contentEnd: baseOffset + cursor,
          source: source.slice(start, end),
          content: source.slice(start + openingSize, cursor),
          closed: true,
        });
        cursor = end;
        closed = true;
        break;
      }
      cursor++;
    }
    if (!closed) {
      const end = cursor;
      ranges.push({
        start: baseOffset + start,
        end: baseOffset + end,
        contentStart: baseOffset + start + openingSize,
        contentEnd: baseOffset + end,
        source: source.slice(start, end),
        content: source.slice(start + openingSize, end),
        closed: false,
      });
    }
  }
  return ranges;
}

export function markdownInlineScopes(source: string, baseOffset = 0): MarkdownInlineSourceScope[] {
  const scopes: MarkdownInlineSourceScope[] = [];
  let cursor = 0;
  while (cursor < source.length) {
    if (source[cursor] === "\n" || isEscaped(source, cursor)) {
      cursor++;
      continue;
    }

    const code = codeScopeAt(source, cursor, baseOffset);
    if (code) {
      scopes.push(code);
      cursor = code.end - baseOffset;
      continue;
    }

    const math = mathScopeAt(source, cursor, baseOffset);
    if (math) {
      scopes.push(math);
      cursor = math.end - baseOffset;
      continue;
    }

    const link = linkScopeAt(source, cursor, baseOffset);
    if (link) {
      scopes.push(link);
      cursor = link.end - baseOffset;
      continue;
    }

    const formatting = formattingScopeAt(source, cursor, baseOffset);
    if (formatting) {
      scopes.push(formatting);
      cursor = formatting.end - baseOffset;
      continue;
    }
    cursor++;
  }
  return scopes;
}

export function markdownInlineScopeAt(
  scopes: readonly MarkdownInlineSourceScope[],
  offset: number,
): MarkdownInlineSourceScope | null {
  for (const scope of scopes) {
    if (offset <= scope.start || offset >= scope.end) continue;
    return markdownInlineScopeAt(scope.children, offset) ?? scope;
  }
  return null;
}

export function flattenMarkdownInlineScopes(
  scopes: readonly MarkdownInlineSourceScope[],
): MarkdownInlineSourceScope[] {
  return scopes.flatMap((scope) => [scope, ...flattenMarkdownInlineScopes(scope.children)]);
}

function codeScopeAt(
  source: string,
  start: number,
  baseOffset: number,
): MarkdownInlineSourceScope | null {
  if (source[start] !== "`") return null;
  let size = 1;
  while (source[start + size] === "`") size++;
  const delimiter = "`".repeat(size);
  const end = findClosing(source, delimiter, start + size);
  if (end < 0) return null;
  return inlineScope(source, start, end + size, size, size, "code", baseOffset);
}

function mathScopeAt(
  source: string,
  start: number,
  baseOffset: number,
): MarkdownInlineSourceScope | null {
  const dollar =
    source[start] === "$" && source[start - 1] !== "$" && source[start + 1] !== "$";
  const parenthesized = source.startsWith("\\(", start);
  if (!dollar && !parenthesized) return null;
  const range = markdownInlineMathRanges(source).find(
    (candidate) => candidate.start === start && candidate.closed,
  );
  if (!range) return null;
  const delimiterSize = parenthesized ? 2 : 1;
  return inlineScope(
    source,
    range.start,
    range.end,
    delimiterSize,
    delimiterSize,
    "math",
    baseOffset,
  );
}

function linkScopeAt(
  source: string,
  start: number,
  baseOffset: number,
): MarkdownInlineSourceScope | null {
  if (source[start] !== "[" || source[start - 1] === "!") return null;
  const labelEnd = findClosing(source, "]", start + 1);
  if (labelEnd < 0 || source[labelEnd + 1] !== "(") return null;
  const targetEnd = findClosing(source, ")", labelEnd + 2);
  if (targetEnd < 0) return null;
  const scope = inlineScope(
    source,
    start,
    targetEnd + 1,
    1,
    targetEnd + 1 - labelEnd,
    "link",
    baseOffset,
  );
  scope.contentEnd = baseOffset + labelEnd;
  scope.content = source.slice(start + 1, labelEnd);
  scope.children = markdownInlineScopes(scope.content, scope.contentStart);
  return scope;
}

function formattingScopeAt(
  source: string,
  start: number,
  baseOffset: number,
): MarkdownInlineSourceScope | null {
  const candidates: Array<{
    delimiter: string;
    kind: MarkdownInlineScopeKind;
  }> = [
    { delimiter: "***", kind: "strong-emphasis" },
    { delimiter: "___", kind: "strong-emphasis" },
    { delimiter: "**", kind: "strong" },
    { delimiter: "__", kind: "strong" },
    { delimiter: "~~", kind: "strikethrough" },
    { delimiter: "*", kind: "emphasis" },
    { delimiter: "_", kind: "emphasis" },
  ];
  for (const { delimiter, kind } of candidates) {
    if (!source.startsWith(delimiter, start)) continue;
    if (
      delimiter.length === 1 &&
      (source[start - 1] === delimiter || source[start + 1] === delimiter)
    )
      continue;
    if (
      delimiter.includes("_") &&
      /[\p{L}\p{N}]/u.test(source[start - 1] ?? "") &&
      /[\p{L}\p{N}]/u.test(source[start + delimiter.length] ?? "")
    )
      continue;
    const closing = findFormattingClosing(source, delimiter, start + delimiter.length);
    if (closing < 0 || closing === start + delimiter.length) continue;
    const end = closing + delimiter.length;
    const scope = inlineScope(
      source,
      start,
      end,
      delimiter.length,
      delimiter.length,
      kind,
      baseOffset,
    );
    scope.children = markdownInlineScopes(scope.content, scope.contentStart);
    return scope;
  }
  return null;
}

function inlineScope(
  source: string,
  start: number,
  end: number,
  openingSize: number,
  closingSize: number,
  kind: MarkdownInlineScopeKind,
  baseOffset: number,
): MarkdownInlineSourceScope {
  const contentStart = start + openingSize;
  const contentEnd = end - closingSize;
  return {
    start: baseOffset + start,
    end: baseOffset + end,
    contentStart: baseOffset + contentStart,
    contentEnd: baseOffset + contentEnd,
    source: source.slice(start, end),
    content: source.slice(contentStart, contentEnd),
    opening: source.slice(start, contentStart),
    closing: source.slice(contentEnd, end),
    kind,
    children: [],
  };
}

function findClosing(source: string, delimiter: string, from: number): number {
  for (let cursor = from; cursor <= source.length - delimiter.length; cursor++) {
    if (source[cursor] === "\n") return -1;
    if (source.startsWith(delimiter, cursor) && !isEscaped(source, cursor)) return cursor;
  }
  return -1;
}

function findFormattingClosing(source: string, delimiter: string, from: number): number {
  for (let cursor = from; cursor <= source.length - delimiter.length; cursor++) {
    if (source[cursor] === "\n") return -1;
    if (!source.startsWith(delimiter, cursor) || isEscaped(source, cursor)) continue;
    if (
      delimiter.length === 1 &&
      (source[cursor - 1] === delimiter || source[cursor + 1] === delimiter)
    )
      continue;
    if (delimiter.length === 2 && delimiter[0] === delimiter[1]) {
      let run = 0;
      while (source[cursor + run] === delimiter[0]) run++;
      if (run > delimiter.length) return cursor + run - delimiter.length;
    }
    return cursor;
  }
  return -1;
}

function sourceLines(source: string): SourceLine[] {
  const lines: SourceLine[] = [];
  let start = 0;
  for (let index = 0; index <= source.length; index++) {
    if (index !== source.length && source[index] !== "\n") continue;
    const hasNewline = index < source.length;
    lines.push({
      start,
      contentEnd: index,
      end: index + (hasNewline ? 1 : 0),
      value: source.slice(start, index),
    });
    start = index + 1;
  }
  return lines;
}

function scopeFromLines(
  source: string,
  lines: readonly SourceLine[],
  startLine: number,
  endLine: number,
  kind: MarkdownSourceScope["kind"],
): MarkdownSourceScope {
  const first = lines[startLine];
  const last = lines[Math.max(startLine, endLine - 1)];
  return {
    start: first.start,
    end: last.end,
    startLine,
    endLine,
    kind,
    source: source.slice(first.start, last.end),
  };
}

function isEscaped(source: string, index: number): boolean {
  let slashes = 0;
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === "\\"; cursor--) slashes++;
  return slashes % 2 === 1;
}
