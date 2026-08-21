// src/react/CanvasToolbar.tsx

import type { ReactNode } from "react";

export type CanvasTool = "select" | "hand" | "card" | "text" | "link" | "image";

export interface CanvasToolbarItem {
  tool: CanvasTool;
  label: string;
  icon?: ReactNode;
}

export interface CanvasToolbarProps {
  value: CanvasTool;

  onChange(tool: CanvasTool): void;

  items?: CanvasToolbarItem[];

  className?: string;
}

const defaultItems: CanvasToolbarItem[] = [
  {
    tool: "select",
    label: "Select",
  },
  {
    tool: "hand",
    label: "Pan",
  },
  {
    tool: "card",
    label: "Card",
  },
  {
    tool: "text",
    label: "Text",
  },
  {
    tool: "link",
    label: "Link",
  },
  {
    tool: "image",
    label: "Image",
  },
];

export function CanvasToolbar({
  value,
  onChange,
  items = defaultItems,
  className,
}: CanvasToolbarProps) {
  return (
    <div
      className={className}
      role="toolbar"
      aria-label="Canvas tools"
      style={{
        display: "flex",
        gap: 4,
        padding: 4,
        border: "1px solid #ddd",
        borderRadius: 8,
        background: "white",
      }}
    >
      {items.map((item) => {
        const active = value === item.tool;

        return (
          <button
            key={item.tool}
            type="button"
            aria-pressed={active}
            title={item.label}
            onClick={() => onChange(item.tool)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,

              height: 34,
              padding: "0 10px",

              border: active ? "1px solid #999" : "1px solid transparent",

              borderRadius: 6,

              background: active ? "#eee" : "transparent",

              cursor: "pointer",
            }}
          >
            {item.icon}

            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
