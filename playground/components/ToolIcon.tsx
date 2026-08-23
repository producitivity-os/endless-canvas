export type ToolIconName =
  | "select"
  | "hand"
  | "card"
  | "text"
  | "markdown"
  | "image"
  | "rect"
  | "ellipse"
  | "diamond"
  | "pentagon"
  | "parallelogram"
  | "arrow"
  | "line"
  | "pencil";

export function ToolIcon({ name }: { name: ToolIconName }) {
  const content = {
    select: <path d="m5 3 12 10-6.2 1.1L7.6 20 5 3Z" />,
    hand: (
      <path d="M8.2 11V6.5a1.5 1.5 0 0 1 3 0V10m0-4.5a1.5 1.5 0 0 1 3 0V10m0-3.5a1.5 1.5 0 0 1 3 0V11m0-2.5a1.5 1.5 0 0 1 3 0v4.4c0 4.5-2.8 7.1-7 7.1h-.7c-2.2 0-3.8-.8-5.2-2.5l-3.1-3.8a1.6 1.6 0 0 1 2.4-2.1l1.6 1.5V11Z" />
    ),
    card: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2.5" />
        <path d="M7 9h10M7 13h7" />
      </>
    ),
    text: <path d="M5 5V3h14v2M12 3v18M8 21h8" />,
    markdown: (
      <>
        <path d="M3 6v12M3 6h3l3 5 3-5h3v12" />
        <path d="M18 7v10m-3-3 3 3 3-3" />
      </>
    ),
    image: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2.5" />
        <circle cx="9" cy="9" r="1.5" />
        <path d="m5 18 4.5-4.5 3 3 2-2L19 19" />
      </>
    ),
    rect: <rect x="3" y="5" width="18" height="14" rx="1.5" />,
    ellipse: <ellipse cx="12" cy="12" rx="9" ry="7" />,
    diamond: <path d="m12 3 9 9-9 9-9-9 9-9Z" />,
    pentagon: <path d="m12 3 9 7-3.5 11h-11L3 10l9-7Z" />,
    parallelogram: <path d="M7 5h15l-5 14H2L7 5Z" />,
    arrow: (
      <>
        <path d="M4 18 19 5" />
        <path d="M13 5h6v6" />
      </>
    ),
    line: <path d="M4 18 20 6" />,
    pencil: (
      <>
        <path d="m4 20 4.2-1 10.9-11a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" />
        <path d="m14.8 6.4 3 3" />
      </>
    ),
  }[name];

  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {content}
    </svg>
  );
}
