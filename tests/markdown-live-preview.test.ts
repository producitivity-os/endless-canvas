import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  flattenMarkdownInlineScopes,
  markdownInlineScopeAt,
  markdownInlineScopes,
  markdownInlineMathRanges,
  markdownScopeAt,
  markdownSourceScopes,
} from "../src/core/markdown/markdown-source-model.ts";

test("ordinary Markdown uses newline-delimited editing scopes", () => {
  const source = "# Heading\nA wrapped paragraph line\nAnother line";
  const scopes = markdownSourceScopes(source);
  assert.deepEqual(
    scopes.map(({ kind, source }) => ({ kind, source })),
    [
      { kind: "line", source: "# Heading\n" },
      { kind: "line", source: "A wrapped paragraph line\n" },
      { kind: "line", source: "Another line" },
    ],
  );
  assert.equal(markdownScopeAt(scopes, source.indexOf("wrapped"))?.startLine, 1);
});

test("multiline Markdown structures remain one source scope", () => {
  const source = "- one\n- two\n\n```ts\nconst x = 1\n```\n> quote\n> continued\nplain";
  const scopes = markdownSourceScopes(source);
  assert.deepEqual(
    scopes.map((scope) => scope.kind),
    ["list", "line", "fence", "blockquote", "line"],
  );
  assert.equal(scopes[0].source, "- one\n- two\n");
  assert.equal(scopes[2].source, "```ts\nconst x = 1\n```\n");
  assert.equal(scopes[3].source, "> quote\n> continued\n");
});

test("inline math ranges expose stable source and content offsets", () => {
  const source = "before $x^2$ and $y + 1$ after";
  assert.deepEqual(markdownInlineMathRanges(source), [
    {
      start: 7,
      end: 12,
      contentStart: 8,
      contentEnd: 11,
      source: "$x^2$",
      content: "x^2",
      closed: true,
    },
    {
      start: 17,
      end: 24,
      contentStart: 18,
      contentEnd: 23,
      source: "$y + 1$",
      content: "y + 1",
      closed: true,
    },
  ]);
});

test("inline math ignores escaped openers and reports unmatched source", () => {
  const source = String.raw`cost \$5 and $open`;
  assert.deepEqual(markdownInlineMathRanges(source), [
    {
      start: 13,
      end: 18,
      contentStart: 14,
      contentEnd: 18,
      source: "$open",
      content: "open",
      closed: false,
    },
  ]);
});

test("parenthesized math exposes source offsets and display math stays one scope", () => {
  const source = "before \\(x + y\\) after";
  assert.deepEqual(markdownInlineMathRanges(source), [
    {
      start: 7,
      end: 16,
      contentStart: 9,
      contentEnd: 14,
      source: "\\(x + y\\)",
      content: "x + y",
      closed: true,
    },
  ]);

  const scopes = markdownSourceScopes("intro\n\\[\n\\frac{a}{b}\n\\]\noutro");
  assert.equal(scopes[1].kind, "math-block");
  assert.equal(scopes[1].source, "\\[\n\\frac{a}{b}\n\\]\n");
});

test("inline Markdown scopes retain exact offsets and nested scope identity", () => {
  const source = "Text **bold *inside***, `code`, ~~gone~~, [link](https://example.com), and $x$.";
  const scopes = markdownInlineScopes(source);
  assert.deepEqual(
    scopes.map(({ kind, source: value }) => [kind, value]),
    [
      ["strong", "**bold *inside***"],
      ["code", "`code`"],
      ["strikethrough", "~~gone~~"],
      ["link", "[link](https://example.com)"],
      ["math", "$x$"],
    ],
  );
  const nestedOffset = source.indexOf("inside") + 2;
  assert.equal(markdownInlineScopeAt(scopes, nestedOffset)?.kind, "emphasis");
  assert.equal(flattenMarkdownInlineScopes(scopes).length, 6);
});

test("a single-dollar formula remains inline when it is the whole line", () => {
  const scopes = markdownInlineScopes("$x$");
  assert.equal(scopes.length, 1);
  assert.deepEqual(scopes[0], {
    start: 0,
    end: 3,
    contentStart: 1,
    contentEnd: 2,
    source: "$x$",
    content: "x",
    opening: "$",
    closing: "$",
    kind: "math",
    children: [],
  });
});

test("double-dollar formulas are excluded from inline scopes", () => {
  assert.deepEqual(markdownInlineMathRanges("$$x$$"), []);
  assert.deepEqual(markdownInlineScopes("$$x$$"), []);
});

test("the live editor preserves explicit caret boundaries around rendered inline scopes", () => {
  const editor = readFileSync(
    new URL("../src/core/interaction/markdown-live-editor.ts", import.meta.url),
    "utf8",
  );
  assert.match(editor, /dataset\.mdCaretAnchor = "true"/);
  assert.match(editor, /this\.caretAnchor\(scope\.end, "after"\)/);
  assert.match(editor, /candidate\.dataset\.caretAffinity === affinity/);
  assert.match(editor, /element\?\.dataset\.mdCaretAnchor !== undefined\) return ""/);
  assert.match(editor, /candidate\.end === this\.focus/);
  assert.match(editor, /candidate\.start === this\.focus/);
});
