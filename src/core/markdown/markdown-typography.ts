export const markdownTypography = {
  fontSize: 16,
  lineHeight: 19,
  paragraphGap: ".15em",
  headingLineHeight: "1.15",
  headingGap: ".12em",
  listItemGap: ".02em",
  codeBlockGap: ".15em",
  displayMathMargin: ".1em 0 .15em",
} as const;

export function markdownBlockCss(prefix = ""): string[] {
  const target = (selector: string) =>
    selector
      .split(",")
      .map((part) => `${prefix}${part.trim()}`)
      .join(", ");
  return [
    `${target("p")} { margin: 0 0 ${markdownTypography.paragraphGap}; }`,
    `${target("p:last-child")} { margin-bottom: 0; }`,
    `${target("h1, h2, h3, h4, h5, h6")} { margin: 0 0 ${markdownTypography.headingGap}; line-height: ${markdownTypography.headingLineHeight}; font-weight: 700; }`,
    `${target("h1")} { font-size: 1.7em; } ${target("h2")} { font-size: 1.45em; } ${target("h3")} { font-size: 1.25em; }`,
    `${target("ul, ol")} { margin: 0 0 ${markdownTypography.paragraphGap}; padding-left: 1.35em; } ${target("li")} { margin: ${markdownTypography.listItemGap} 0; }`,
    `${target("code")} { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', system-ui, sans-serif; background: rgba(100,116,139,.13); padding: .08em .25em; border-radius: .22em; }`,
    `${target("pre")} { margin: 0 0 ${markdownTypography.codeBlockGap}; padding: .55em .7em; background: rgba(100,116,139,.13); border-radius: .35em; white-space: pre; }`,
    `${target("pre code")} { padding: 0; background: transparent; }`,
  ];
}
